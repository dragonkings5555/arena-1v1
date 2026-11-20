// net.js - online play across two devices.
// The host runs the whole game (same code as local play). The guest sends its keys and draws the host's snapshots.
// Transport: PeerJS (WebRTC data channel, free public broker) with a 4-letter room code.
// Test transport: add ?net=bc to the URL and two tabs of the same browser talk over BroadcastChannel.
//
// Snapshot contract for abilities: state must live in plain fields/arrays/objects on the ability instance
// (references to a Player or to another ability instance are fine). Functions are never sent.
window.Game = window.Game || {};

Game.Net = (function () {
  const VERSION = 'v4';
  const PEER_PREFIX = 'arena1v1-room-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const params = new URLSearchParams(location.search);
  const useBC = params.get('net') === 'bc';

  const net = {
    mode: 'local', // 'local' | 'host' | 'guest'
    code: null,
    rtt: null,
    lastSnapBytes: 0,
  };

  let peer = null, conn = null;
  let latestSnap = null;
  let sendTimer = 0, lastSentInput = '';
  let pingTimer = null;
  let origDefs = null;

  // ---------- key mapping: the guest plays with P1's keys, the host applies them to P2 ----------
  const SLOTS = ['up', 'down', 'left', 'right', 'fire', 'ability1', 'ability2', 'ability3', 'ability4'];
  function p1Keys() { return Game.CONFIG.PLAYERS[0].keys; }
  function p2Keys() { return Game.CONFIG.PLAYERS[1].keys; }
  function guestCodes() { return SLOTS.map((s) => p1Keys()[s]).concat(['KeyR']); }
  function mapToP2(code) {
    if (code === 'KeyR') return 'KeyR';
    const k1 = p1Keys(), k2 = p2Keys();
    for (const s of SLOTS) if (k1[s] === code) return k2[s];
    return null;
  }

  // ---------- snapshot encode / decode ----------
  const PLAYER_SKIP = new Set(['def', 'keys', 'spawn', 'name', 'color', 'character', 'abilities', 'onParried']);
  function round(n) { return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }

  function refTables(players) {
    const abil = [];
    players.forEach((p, pi) => (p.abilities || []).forEach((a, ai) => abil.push([a.impl, pi, ai])));
    return abil;
  }

  function makeEncoder(players) {
    const abil = refTables(players);
    function enc(v, depth) {
      const t = typeof v;
      if (t === 'number') return round(v);
      if (t === 'function' || t === 'undefined' || t === 'symbol') return undefined;
      if (v === null || t !== 'object') return v;
      const pi = players.indexOf(v);
      if (pi >= 0) return { $p: pi };
      for (const [impl, a, b] of abil) if (impl === v) return { $a: [a, b] };
      if (depth > 8) return undefined;
      if (Array.isArray(v)) return v.map((x) => { const e = enc(x, depth + 1); return e === undefined ? null : e; });
      const o = {};
      for (const k in v) {
        if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
        const e = enc(v[k], depth + 1);
        if (e !== undefined) o[k] = e;
      }
      return o;
    }
    // Encode an object's own fields (the object itself may be a Player/ability, which enc() would turn into a ref).
    function fields(obj, skip) {
      const o = {};
      for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k) || (skip && skip.has(k))) continue;
        const e = enc(obj[k], 1);
        if (e !== undefined) o[k] = e;
      }
      return o;
    }
    return { enc, fields };
  }

  function makeDecoder(players) {
    function dec(v) {
      if (v === null || typeof v !== 'object') return v;
      if (Array.isArray(v)) return v.map(dec);
      if ('$p' in v) return players[v.$p];
      if ('$a' in v) { const p = players[v.$a[0]]; return p && p.abilities[v.$a[1]] ? p.abilities[v.$a[1]].impl : null; }
      const o = {};
      for (const k in v) o[k] = dec(v[k]);
      return o;
    }
    return dec;
  }

  function buildSnapshot() {
    const players = Game.players, state = Game.state;
    const E = makeEncoder(players);
    return {
      t: 's',
      rtt: net.rtt,
      state: { phase: state.phase, timer: round(state.timer), roundWinner: state.roundWinner ? players.indexOf(state.roundWinner) : -1 },
      select: { cursors: Game.Select.cursors.slice(), locked: Game.Select.locked.slice(), readyTimer: round(Game.Select.readyTimer) },
      fx: E.fields(Game.FX),
      combat: E.fields(Game.Combat),
      players: players.map((p) => ({
        char: p.character.id,
        f: E.fields(p, PLAYER_SKIP),
        ab: p.abilities.map((a) => E.fields(a.impl)),
      })),
    };
  }

  function applySnapshot(s) {
    const players = Game.players, state = Game.state;
    // Characters first, so ability instances exist before refs are decoded.
    s.players.forEach((ps, i) => {
      const p = players[i];
      if (!p.character || p.character.id !== ps.char) {
        const def = Game.Characters.find((c) => c.id === ps.char);
        if (def) p.setCharacter(def);
      }
    });
    const dec = makeDecoder(players);
    s.players.forEach((ps, i) => {
      const p = players[i];
      Object.assign(p, dec(ps.f));
      ps.ab.forEach((a, j) => { if (p.abilities[j]) Object.assign(p.abilities[j].impl, dec(a)); });
    });
    Object.assign(Game.Combat, dec(s.combat));
    Object.assign(Game.FX, dec(s.fx));
    Object.assign(Game.Select, s.select);
    state.phase = s.state.phase;
    state.timer = s.state.timer;
    state.roundWinner = s.state.roundWinner >= 0 ? players[s.state.roundWinner] : null;
    if (s.rtt != null) net.rtt = s.rtt;
  }

  // ---------- per-frame hooks called by main.js ----------
  const SNAP_INTERVAL = 1000 / 40; // ms; ~40 snapshots/s keeps bandwidth near 1-2 Mbit/s even with lots of particles
  let lastSnapAt = 0;
  net.hostTick = function () {
    if (!conn || !conn.open) return;
    const now = performance.now();
    if (now - lastSnapAt < SNAP_INTERVAL - 2) return;
    lastSnapAt = now;
    const dc = conn.dataChannel;
    if (dc && dc.bufferedAmount > 64 * 1024) return; // slow link: skip a frame instead of queueing lag
    const s = JSON.stringify(buildSnapshot());
    net.lastSnapBytes = s.length;
    conn.send(s);
  };

  net.guestTick = function (dt) {
    const input = Game.Input;
    const codes = guestCodes();
    const d = codes.filter((c) => input.isDown(c));
    const p = codes.filter((c) => input.wasPressed(c));
    const r = codes.filter((c) => input.wasReleased(c));
    sendTimer += dt;
    const key = d.join(',');
    // Send on any change, and re-send the held keys a few times a second so a lost message can't leave a key stuck.
    if (conn && conn.open && (p.length || r.length || key !== lastSentInput || sendTimer > 0.15)) {
      conn.send(JSON.stringify({ t: 'in', d, p, r }));
      lastSentInput = key;
      sendTimer = 0;
    }
    if (latestSnap) { applySnapshot(latestSnap); latestSnap = null; }
  };

  function hostApplyInput(m) {
    const input = Game.Input;
    m.p.forEach((c) => { const k = mapToP2(c); if (k) input.setKey(k, true); });
    m.r.forEach((c) => { const k = mapToP2(c); if (k) input.setKey(k, false); });
    const want = new Set(m.d.map(mapToP2));
    SLOTS.map((s) => p2Keys()[s]).concat(['KeyR']).forEach((k) => {
      if (k === 'KeyR' && !want.has(k)) return; // never release the host's own R
      if (want.has(k) !== input.isDown(k)) input.setKey(k, want.has(k));
    });
  }

  // ---------- keep the host running in a background tab ----------
  // rAF stops in hidden tabs and plain timers get throttled to ~1/s, but worker timers keep ticking.
  let bgWorker = null;
  function bgLoop(on) {
    if (on && !bgWorker) {
      try {
        const src = 'setInterval(() => postMessage(0), 1000 / 60);';
        bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        bgWorker.onmessage = () => { if (document.hidden && net.mode === 'host' && Game.tick) Game.tick(performance.now()); };
      } catch (e) { bgWorker = null; }
    } else if (!on && bgWorker) { bgWorker.terminate(); bgWorker = null; }
  }

  // ---------- session setup ----------
  function onlineLabels(isGuest) {
    const players = Game.players;
    if (!origDefs) origDefs = players.map((p) => ({ def: p.def, name: p.name }));
    const cfg = Game.CONFIG.PLAYERS;
    // Both online players use the P1 layout on their own keyboard.
    players[1].def = Object.assign({}, cfg[1], { keyLabels: cfg[0].keyLabels });
    players[0].name = isGuest ? 'Player 1' : 'Player 1 (you)';
    players[1].name = isGuest ? 'Player 2 (you)' : 'Player 2';
    Game.Select.hint = 'A/D choose, Space lock in';
    Game.HUD.hint = 'WASD move · Space shoot · E C Q F abilities';
  }

  function restoreLocal() {
    const players = Game.players;
    if (origDefs) players.forEach((p, i) => { p.def = origDefs[i].def; p.name = origDefs[i].name; });
    origDefs = null;
    Game.Select.hint = null;
    Game.HUD.hint = null;
    Game.Input.blockLocal.clear();
    SLOTS.map((s) => p2Keys()[s]).forEach((k) => { if (Game.Input.isDown(k)) Game.Input.setKey(k, false); });
  }

  function startSession(mode, c) {
    conn = c;
    net.mode = mode;
    onlineLabels(mode === 'guest');
    if (mode === 'host') {
      // Ignore the host keyboard's P2 keys; P2 is the remote player now.
      SLOTS.forEach((s) => Game.Input.blockLocal.add(p2Keys()[s]));
      Game.players.forEach((p) => { p.wins = 0; });
      Game.openSelect();
      clearInterval(pingTimer);
      bgLoop(true);
      pingTimer = setInterval(() => { if (conn && conn.open) conn.send(JSON.stringify({ t: 'ping', ts: performance.now() })); }, 1000);
    }
    UI.hide();
    UI.status();
  }

  function endSession(reason) {
    clearInterval(pingTimer);
    bgLoop(false);
    const wasOnline = net.mode !== 'local';
    net.mode = 'local';
    latestSnap = null;
    net.rtt = null;
    if (conn) { try { conn.close(); } catch (e) {} }
    conn = null;
    if (peer) { try { peer.destroy(); } catch (e) {} }
    peer = null;
    if (wasOnline) { restoreLocal(); Game.openSelect(); }
    UI.status();
    UI.show(reason || '');
  }

  function onData(raw) {
    let m = raw;
    if (typeof raw === 'string') { try { m = JSON.parse(raw); } catch (e) { return; } }
    if (!m || !m.t) return;
    if (m.t === 's' && net.mode === 'guest') { latestSnap = m; net.lastSnapBytes = raw.length || 0; }
    else if (m.t === 'in' && net.mode === 'host') hostApplyInput(m);
    else if (m.t === 'ping' && net.mode === 'guest') conn.send(JSON.stringify({ t: 'pong', ts: m.ts }));
    else if (m.t === 'pong' && net.mode === 'host') { net.rtt = Math.round(performance.now() - m.ts); UI.status(); }
  }

  function wire(c, mode) {
    c.on('data', onData);
    c.on('close', () => { if (conn === c) endSession(mode === 'host' ? 'Your friend left the room.' : 'The host left the room.'); });
    c.on('error', () => { if (conn === c) endSession('Connection lost.'); });
  }

  function randomCode() {
    let s = '';
    for (let i = 0; i < 4; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    return s;
  }

  // ---------- transports ----------
  // Tiny event emitter shared by the BroadcastChannel test transport.
  function emitter(o) {
    const h = {};
    o.on = (ev, fn) => { (h[ev] = h[ev] || []).push(fn); return o; };
    o.emit = (ev, a) => (h[ev] || []).forEach((fn) => fn(a));
    return o;
  }
  function bcConn(code, me) {
    const ch = new BroadcastChannel('arena1v1-' + code);
    const c = emitter({ open: false, dataChannel: null });
    c.send = (data) => ch.postMessage({ from: me, data });
    c.close = () => { if (c.open) { c.open = false; ch.postMessage({ from: me, bye: true }); ch.close(); } };
    ch.onmessage = (e) => {
      const m = e.data;
      if (m.from === me) return;
      if (m.hello && !c.open) { c.open = true; if (me === 'host') ch.postMessage({ from: me, hello: true }); c.emit('open'); }
      else if (m.bye) { c.open = false; c.emit('close'); }
      else if (m.data !== undefined) c.emit('data', m.data);
    };
    return { c, ch };
  }

  // STUN finds each device's public address; TURN relays traffic when the two networks block a direct link
  // (common on phones on mobile data, school/work wifi). Several servers so one being down doesn't break joining.
  const ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject', credential: 'openrelayproject' },
  ];
  function peerOpts() { return { debug: 1, config: { iceServers: ICE_SERVERS } }; }

  // Visible debug line on the room/join screens, so a failed connect can be reported exactly.
  const dbg = { server: '-', link: '-', last: '' };
  function debug(k, v) { dbg[k] = v; UI.debugLine('debug ' + VERSION + ' \u00B7 server: ' + dbg.server + ' \u00B7 link: ' + dbg.link + (dbg.last ? ' \u00B7 ' + dbg.last : '')); }

  let attempt = 0; // bumps on every host/join so timers from an old attempt can't show errors over a new one

  // Watch the WebRTC link of a connection that hasn't opened yet and say what is happening.
  function watchIce(c, isCurrent, onFail) {
    const pc = c.peerConnection;
    if (!pc) return;
    pc.addEventListener('iceconnectionstatechange', () => {
      if (!isCurrent()) return;
      const st = pc.iceConnectionState;
      debug('link', st);
      if (st === 'checking') UI.setMsg('Linking the two devices...');
      if (st === 'failed') onFail();
    });
  }

  net.host = function () {
    endQuiet();
    const my = ++attempt;
    const code = randomCode();
    net.code = code;
    if (useBC) {
      UI.waiting(code);
      const { c } = bcConn(code, 'host');
      c.on('open', () => { wire(c, 'host'); startSession('host', c); });
      peer = { destroy() { c.close(); } };
      return;
    }
    if (!window.Peer) return UI.error('Online play could not load (PeerJS missing).');
    UI.connecting('Creating room...');
    const p = peer = new Peer(PEER_PREFIX + code, peerOpts());
    const cur = () => my === attempt && net.mode === 'local';
    const regTimeout = setTimeout(() => { if (cur() && !p.open) UI.error('Could not reach the game server to create a room. Check your internet and try again.'); }, 12000);
    debug('server', 'connecting'); debug('link', '-');
    p.on('open', () => { clearTimeout(regTimeout); if (cur()) { UI.waiting(code); debug('server', 'registered ' + code); } });
    // Phones drop the server connection when you switch apps (e.g. to send the code); reconnect so the room stays joinable.
    p.on('disconnected', () => { debug('server', 'lost, reconnecting'); });
    p.on('disconnected', () => { if (my === attempt && !p.destroyed) setTimeout(() => { if (!p.destroyed) p.reconnect(); }, 500); });
    p.on('error', (e) => {
      debug('last', 'error ' + e.type);
      if (!cur()) return;
      if (e.type === 'unavailable-id') return net.host(); // code taken, roll a new one
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed') return; // handled by reconnect
      UI.error('Room problem (' + (e.type || e.message) + '). Try creating the room again.');
    });
    p.on('connection', (c) => {
      if (conn) { c.on('open', () => c.close()); return; } // room is full
      if (cur()) UI.setMsg('Your friend found the room. Linking the two devices...');
      debug('last', 'friend knocked');
      c.on('open', () => { if (my === attempt) { wire(c, 'host'); startSession('host', c); } });
      setTimeout(() => watchIce(c, cur, () => UI.setMsg('Your friend found the room, but your networks blocked the link. Try a different wifi or mobile data.')), 0);
    });
  };

  net.join = function (code) {
    code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) return UI.error('Enter the 4-letter room code.');
    endQuiet();
    const my = ++attempt;
    net.code = code;
    UI.joining(code);
    if (useBC) {
      const { c, ch } = bcConn(code, 'guest');
      c.on('open', () => { wire(c, 'guest'); startSession('guest', c); });
      ch.postMessage({ from: 'guest', hello: true });
      peer = { destroy() { c.close(); } };
      return;
    }
    if (!window.Peer) return UI.error('Online play could not load (PeerJS missing).');
    const p = peer = new Peer(peerOpts());
    const cur = () => my === attempt && net.mode === 'local';
    let stage = 'server';
    debug('server', 'connecting'); debug('link', '-'); debug('last', '');
    const fail = (msg) => { if (cur()) { endQuiet(); UI.error(msg); } };
    const timeout = setTimeout(() => {
      if (stage === 'server') fail('Could not reach the game server. Check your internet and try again.');
      else fail('Found room ' + code + ' but could not link to the host. Make sure the host is still on the room screen (on a phone, keep the game open), then try again. If it keeps failing, one of your networks is blocking it: try mobile data or a different wifi.');
    }, 25000);
    p.on('open', () => {
      if (!cur()) return;
      stage = 'room';
      debug('server', 'ok');
      UI.setMsg('Looking for room ' + code + '...');
      const c = p.connect(PEER_PREFIX + code, { reliable: true, serialization: 'raw' });
      c.on('open', () => { clearTimeout(timeout); if (my === attempt) { wire(c, 'guest'); startSession('guest', c); } });
      c.on('error', (e) => { debug('last', 'conn error ' + (e.type || e.message)); if (cur()) UI.setMsg('Connection error: ' + (e.type || e.message)); });
      setTimeout(() => watchIce(c, cur, () => { stage = 'ice'; }), 0);
    });
    p.on('error', (e) => {
      debug('last', 'error ' + e.type);
      if (!cur()) return;
      clearTimeout(timeout);
      if (e.type === 'peer-unavailable') fail('No room with code ' + code + '. Check the code, and that the host is still on the room screen.');
      else fail('Could not connect (' + (e.type || e.message) + '). Try again.');
    });
  };

  // Tear down any half-open attempt without showing a message.
  function endQuiet() {
    if (peer) { try { peer.destroy(); } catch (e) {} }
    peer = null;
  }

  // "Test my connection": can we reach the game server, and which kinds of network routes does this device get?
  // host = same-network route, srflx = internet route (STUN), relay = relay server (TURN, works on strict networks).
  net.selfTest = function () {
    UI.connecting('Testing your connection (about 8 seconds)...');
    const out = [];
    let server = 'no reply';
    try {
      const tp = new Peer(peerOpts());
      tp.on('open', () => { server = 'ok'; tp.destroy(); });
      tp.on('error', (e) => { server = 'error ' + e.type; });
    } catch (e) { server = 'PeerJS failed: ' + e.message; }
    const kinds = { host: 0, srflx: 0, relay: 0 };
    const relays = new Set();
    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.createDataChannel('t');
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const m = / typ (\w+)/.exec(e.candidate.candidate);
        if (m && m[1] in kinds) kinds[m[1]]++;
        if (m && m[1] === 'relay' && e.candidate.url) relays.add(e.candidate.url.split(':')[1]);
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o));
    } catch (e) { out.push('WebRTC unavailable: ' + e.message); }
    setTimeout(() => {
      if (pc) pc.close();
      out.unshift('Game server: ' + server);
      out.push('Routes: same-network ' + kinds.host + ', internet ' + kinds.srflx + ', relay ' + kinds.relay + (relays.size ? ' (' + [...relays].join(', ') + ')' : ''));
      const ok = server === 'ok' && (kinds.srflx || kinds.relay);
      UI.show((ok ? 'Looks OK. ' : 'Problem found. ') + out.join(' | ') + ' | ' + VERSION);
    }, 8000);
  };

  net.leave = function () { endSession(''); };
  net.local = function () { endQuiet(); UI.hide(); UI.status(); };

  // ---------- UI: start menu overlay, status line, touch controls ----------
  const UI = (function () {
    const css = `
      #net-menu { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10;
        background: rgba(5,7,12,.72); font-family: system-ui, sans-serif; color: #e6ebf5; padding: 16px; box-sizing: border-box; }
      #net-menu[hidden] { display: none; }
      #net-menu .card { background: #151a26; border: 1px solid #2a3248; border-radius: 12px; padding: 22px; width: min(380px, 100%);
        box-shadow: 0 20px 60px rgba(0,0,0,.5); display: flex; flex-direction: column; gap: 12px; }
      #net-menu h1 { margin: 0 0 4px; font-size: 26px; text-align: center; letter-spacing: .5px; }
      #net-menu button { font: 600 16px system-ui, sans-serif; padding: 12px; border-radius: 8px; border: 0; cursor: pointer;
        background: #253049; color: #e6ebf5; }
      #net-menu button.primary { background: #4fc3f7; color: #06202c; }
      #net-menu button:hover { filter: brightness(1.12); }
      #net-menu .row { display: flex; gap: 8px; }
      #net-menu input { flex: 1; min-width: 0; font: 700 20px ui-monospace, monospace; letter-spacing: 6px; text-transform: uppercase;
        text-align: center; padding: 10px; border-radius: 8px; border: 1px solid #2a3248; background: #0b0e14; color: #fff; }
      #net-menu .sep { text-align: center; color: #7d8799; font-size: 13px; }
      #net-menu .msg { min-height: 1.2em; text-align: center; font-size: 14px; color: #ffb4a2; }
      #net-menu .msg.ok { color: #b9f6ca; }
      #net-menu .code { font: 800 44px ui-monospace, monospace; letter-spacing: 10px; text-align: center; color: #ffd54f; }
      #net-menu .small { font-size: 13px; color: #9aa4b8; text-align: center; word-break: break-all; }
      #net-status { font: 13px system-ui, sans-serif; color: #9aa4b8; text-align: center; min-height: 1.2em; }
      #net-status button { font: 12px system-ui, sans-serif; margin-left: 8px; padding: 3px 10px; border-radius: 6px; border: 1px solid #2a3248;
        background: #151a26; color: #c9d1e0; cursor: pointer; }
      #net-touch { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
      #net-touch[hidden] { display: none; }
      #net-touch .stick { position: absolute; left: 22px; bottom: 22px; width: 130px; height: 130px; border-radius: 50%;
        background: rgba(255,255,255,.08); border: 2px solid rgba(255,255,255,.18); pointer-events: auto; touch-action: none; }
      #net-touch .knob { position: absolute; left: 40px; top: 40px; width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,.3); }
      #net-touch .btns { position: absolute; right: 18px; bottom: 18px; display: grid; grid-template-columns: repeat(3, 62px); gap: 8px; pointer-events: auto; }
      #net-touch .btns button { width: 62px; height: 62px; border-radius: 50%; border: 2px solid rgba(255,255,255,.22); background: rgba(255,255,255,.1);
        color: #fff; font: 700 11px system-ui, sans-serif; touch-action: none; user-select: none; -webkit-user-select: none; padding: 0; }
      #net-touch .btns button.fire { background: rgba(79,195,247,.35); font-size: 13px; }
      #net-touch .btns button.on { background: rgba(255,255,255,.4); }
      #net-touch .btns button:disabled { opacity: .25; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const menu = document.createElement('div');
    menu.id = 'net-menu';
    document.body.appendChild(menu);

    const status = document.createElement('div');
    status.id = 'net-status';
    const canvas = document.getElementById('game');
    canvas.insertAdjacentElement('afterend', status);

    function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
    function card(inner) { menu.innerHTML = ''; const c = el('<div class="card"></div>'); c.innerHTML = inner; menu.appendChild(c); menu.hidden = false; return c; }
    let lastDebug = '';
    function shareLink(code) { const u = new URL(location.href); u.searchParams.set('room', code); return u.toString(); }

    const ui = {
      show(msg) {
        const c = card(`
          <h1>Arena 1v1</h1>
          <button class="primary" data-a="host">Play online: create room</button>
          <div class="row"><input maxlength="4" placeholder="CODE" aria-label="Room code" autocomplete="off" autocapitalize="characters"><button data-a="join">Join</button></div>
          <div class="sep">or</div>
          <button data-a="local">Local 2 players (one keyboard)</button>
          <div class="msg"></div>
          <button data-a="check" style="font-size:13px;padding:8px">Test my connection</button>
          <div class="small dbg"></div>`);
        c.querySelector('.msg').textContent = msg || '';
        c.querySelector('.dbg').textContent = msg ? lastDebug : 'version ' + VERSION;
        c.querySelector('[data-a=check]').onclick = () => net.selfTest();
        const inp = c.querySelector('input');
        c.querySelector('[data-a=host]').onclick = () => net.host();
        c.querySelector('[data-a=join]').onclick = () => net.join(inp.value);
        inp.onkeydown = (e) => { if (e.key === 'Enter') net.join(inp.value); };
        c.querySelector('[data-a=local]').onclick = () => net.local();
      },
      waiting(code) {
        const link = shareLink(code);
        const c = card(`
          <h1>Room created</h1>
          <div class="small">Tell your friend this code</div>
          <div class="code"></div>
          <div class="small">or send them this link:</div>
          <div class="small link"></div>
          <button data-a="copy">Copy link</button>
          <div class="msg ok">Waiting for your friend to join... Keep this screen open.</div>
          <button data-a="back">Cancel</button><div class="small dbg"></div>`);
        c.querySelector('.dbg').textContent = lastDebug;
        c.querySelector('.code').textContent = code;
        c.querySelector('.link').textContent = link;
        c.querySelector('[data-a=copy]').onclick = (e) => {
          const b = e.target;
          (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => { b.textContent = 'Copied!'; }, () => { b.textContent = 'Copy failed, select the link above'; });
        };
        c.querySelector('[data-a=back]').onclick = () => { attempt++; endQuiet(); ui.show(''); };
      },
      connecting(text) {
        const c = card(`<h1>Online</h1><div class="msg ok"></div><button data-a="back">Cancel</button><div class="small dbg"></div>`);
        c.querySelector('.msg').textContent = text;
        c.querySelector('[data-a=back]').onclick = () => { attempt++; endQuiet(); ui.show(''); };
      },
      debugLine(text) { lastDebug = text; const d = menu.querySelector('.dbg'); if (d) d.textContent = text; },
      setMsg(text) { const m = menu.querySelector('.msg'); if (m && !menu.hidden) m.textContent = text; },
      joining(code) {
        const c = card(`<h1>Joining ${code}...</h1><div class="msg ok">Connecting to the game server...</div><button data-a="back">Cancel</button><div class="small dbg"></div>`);
        c.querySelector('[data-a=back]').onclick = () => { attempt++; endQuiet(); ui.show(''); };
      },
      error(msg) {
        ui.show(msg);
      },
      hide() { menu.hidden = true; canvas.focus && canvas.focus(); },
      status() {
        status.innerHTML = '';
        const span = document.createElement('span');
        if (net.mode === 'local') {
          span.textContent = 'Local 2 players';
          status.appendChild(span);
          const b = document.createElement('button'); b.textContent = 'Play online'; b.onclick = () => ui.show('');
          status.appendChild(b);
        } else {
          const me = net.mode === 'host' ? 'Player 1 (blue)' : 'Player 2 (orange)';
          span.textContent = 'Online · room ' + net.code + ' · you are ' + me + (net.rtt != null ? ' · ping ' + net.rtt + ' ms' : '');
          status.appendChild(span);
          const b = document.createElement('button'); b.textContent = 'Leave'; b.onclick = () => net.leave();
          status.appendChild(b);
        }
        touch.refresh();
      },
    };

    // ---- touch controls: drive the P1 key codes, which net.js already sends/maps ----
    const touch = (function () {
      const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
      const root = el('<div id="net-touch" hidden><div class="stick"><div class="knob"></div></div><div class="btns"></div></div>');
      document.body.appendChild(root);
      const stick = root.querySelector('.stick'), knob = root.querySelector('.knob'), btns = root.querySelector('.btns');
      const K = () => p1Keys();
      const dirs = { up: false, down: false, left: false, right: false };
      function setDir(name, on) {
        if (dirs[name] === on) return;
        dirs[name] = on;
        Game.Input.setKey(K()[name], on);
      }
      let sid = null;
      function moveStick(e) {
        const r = stick.getBoundingClientRect();
        let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const max = r.width / 2 - 20, len = Math.hypot(dx, dy);
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const dead = 14;
        setDir('left', dx < -dead); setDir('right', dx > dead); setDir('up', dy < -dead); setDir('down', dy > dead);
      }
      function endStick() { sid = null; knob.style.transform = ''; ['up', 'down', 'left', 'right'].forEach((n) => setDir(n, false)); }
      stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); moveStick(e); e.preventDefault(); });
      stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e); });
      stick.addEventListener('pointerup', endStick);
      stick.addEventListener('pointercancel', endStick);

      const defs = [['ability3'], ['ability1'], ['ability4'], ['ability2'], ['fire', 'Shoot'], ['restart', 'R']];
      const buttons = defs.map(([slot, label]) => {
        const b = document.createElement('button');
        b.dataset.slot = slot;
        b.textContent = label || slot;
        if (slot === 'fire') b.className = 'fire';
        const code = () => (slot === 'restart' ? 'KeyR' : K()[slot]);
        const up = () => { b.classList.remove('on'); Game.Input.setKey(code(), false); };
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); Game.Input.setKey(code(), true); });
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('contextmenu', (e) => e.preventDefault());
        btns.appendChild(b);
        return b;
      });
      function myPlayer() { return Game.players && Game.players[net.mode === 'guest' ? 1 : 0]; }
      function labels() {
        const p = myPlayer();
        const abs = (p && p.character && p.character.abilities) || [];
        buttons.forEach((b) => {
          const slot = b.dataset.slot;
          if (!/^ability/.test(slot)) return;
          const a = abs.find((x) => x.slot === slot);
          b.textContent = a ? Game.Select.pretty(a.ability).split(' ').pop() : '';
          b.disabled = !a;
        });
      }
      setInterval(() => { if (!root.hidden) labels(); }, 500);
      return {
        refresh() {
          // Online only (local mode needs two keyboards' worth of keys anyway). ?touch=1 forces them on.
          root.hidden = !((isTouch || params.get('touch') === '1') && net.mode !== 'local');
          if (!root.hidden) labels();
        },
      };
    })();

    return ui;
  })();

  // Start: auto-join from a shared link, otherwise show the menu over the (already running) local game.
  setTimeout(() => {
    const room = params.get('room');
    if (room) net.join(room);
    else UI.show('');
    UI.status();
  }, 0);

  net.UI = UI;
  return net;
})();
