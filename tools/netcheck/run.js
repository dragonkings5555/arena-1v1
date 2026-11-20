// Network check for online play. Runs on a GitHub Actions runner (real internet, sudo for firewall rules).
// 1) the signalling server and the live site
// 2) every STUN/TURN server with a real allocation (credentials + transport)
// 3) Chrome's own ICE gathering per TURN server (relay candidates, ICE errors)
// 4) two browsers playing through the live site and the real broker, with direct links forbidden
//    (relay-only, like school wifi that isolates devices), and with UDP / non-web ports blocked.
const fs = require('fs');
const { execSync } = require('child_process');
const pw = require('playwright');
const { testStun, testTurn } = require('./stunturn');

const LIVE = process.env.LIVE || 'https://dragonkings5555.github.io/arena-1v1/?v=5';
const LOCAL = process.env.LOCAL || ''; // the branch's own copy served on localhost, if set
const ONLY = process.env.ONLY || '';   // comma list of steps: site,raw,gather,e2e
const step = (s) => !ONLY || ONLY.split(',').includes(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { when: new Date().toISOString() };
const log = (...a) => console.log(...a);

const P = ['peerjs', 'peerjsp'];
const O = ['openrelayproject', 'openrelayproject'];
const O2 = ['openrelayproject', 'openrelayprojectsecret'];
const F = ['free', 'free'];
const TURN = [
  // in the live v5 config
  ['turn:eu-0.turn.peerjs.com:3478', P, 'live'],
  ['turn:us-0.turn.peerjs.com:3478', P, 'live'],
  ['turn:openrelay.metered.ca:80', O, 'live'],
  ['turn:openrelay.metered.ca:443', O, 'live'],
  ['turn:openrelay.metered.ca:443?transport=tcp', O, 'live'],
  // other transports and other free servers
  ['turn:eu-0.turn.peerjs.com:3478?transport=tcp', P],
  ['turn:us-0.turn.peerjs.com:3478?transport=tcp', P],
  ['turn:eu-0.turn.peerjs.com:443?transport=tcp', P],
  ['turns:eu-0.turn.peerjs.com:443?transport=tcp', P],
  ['turns:us-0.turn.peerjs.com:443?transport=tcp', P],
  ['turns:eu-0.turn.peerjs.com:5349?transport=tcp', P],
  ['turns:us-0.turn.peerjs.com:5349?transport=tcp', P],
  ['turn:openrelay.metered.ca:80?transport=tcp', O],
  ['turns:openrelay.metered.ca:443?transport=tcp', O],
  ['turn:staticauth.openrelay.metered.ca:80', O2],
  ['turn:staticauth.openrelay.metered.ca:80?transport=tcp', O2],
  ['turn:staticauth.openrelay.metered.ca:443', O2],
  ['turn:staticauth.openrelay.metered.ca:443?transport=tcp', O2],
  ['turns:staticauth.openrelay.metered.ca:443?transport=tcp', O2],
  ['turn:freeturn.net:3478', F],
  ['turn:freeturn.net:3478?transport=tcp', F],
  ['turn:freeturn.net:5349?transport=tcp', F],
  ['turns:freeturn.tel:5349?transport=tcp', F],
  ['turns:freeturn.net:5349?transport=tcp', F],
  ['turn:freeturn.net:443?transport=tcp', F],
  ['turns:freeturn.tel:443?transport=tcp', F],
];
const STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478',
  'stun:openrelay.metered.ca:80', 'stun:stun.relay.metered.ca:80', 'stun:freeturn.net:3478', 'stun:freeturn.net:5349'];

// ---------- firewall conditions ----------
function sh(cmd) { try { return execSync(cmd, { stdio: 'pipe' }).toString().trim(); } catch (e) { return 'ERR ' + (e.stderr || e.message).toString().trim(); } }
function setNet(cond) {
  for (const t of ['iptables', 'ip6tables']) {
    sh(`sudo ${t} -N NETCHECK`);
    sh(`sudo ${t} -F NETCHECK`);
    if (sh(`sudo ${t} -C OUTPUT -j NETCHECK`).startsWith('ERR')) sh(`sudo ${t} -I OUTPUT 1 -j NETCHECK`);
    if (cond === 'open') continue;
    const rules = ['-o lo -j RETURN', '-m conntrack --ctstate ESTABLISHED,RELATED -j RETURN',
      '-p udp --dport 53 -j RETURN', '-p tcp --dport 53 -j RETURN'];
    if (t === 'iptables') rules.unshift('-d 168.63.129.16 -j RETURN');
    rules.push('-p udp -j DROP');
    if (cond === 'webonly') rules.push('-p tcp -m multiport --dports 80,443 -j RETURN', '-p tcp -j DROP');
    for (const r of rules) { const o = sh(`sudo ${t} -A NETCHECK ${r}`); if (o.startsWith('ERR')) log('iptables:', o); }
  }
  log(`\n[network: ${cond}]`);
}

// ---------- browsers ----------
async function launch(kind) {
  if (kind === 'firefox') return pw.firefox.launch({ headless: true });
  try { return await pw.chromium.launch({ channel: 'chrome', headless: true }); }
  catch (e) { return pw.chromium.launch({ headless: true }); }
}

async function gatherAll() {
  const b = await launch('chrome');
  const page = await b.newPage();
  await page.goto('about:blank');
  const out = [];
  for (const [url, [username, credential]] of TURN) {
    const r = await page.evaluate(async ({ server, ms }) => {
      const pc = new RTCPeerConnection({ iceServers: [server], iceTransportPolicy: 'relay' });
      pc.createDataChannel('x');
      const relay = [], errs = [];
      const t0 = performance.now();
      pc.onicecandidate = (e) => {
        if (e.candidate && e.candidate.candidate) relay.push((e.candidate.relayProtocol || '?') + '@' + Math.round(performance.now() - t0) + 'ms');
      };
      pc.onicecandidateerror = (e) => errs.push(e.errorCode + ' ' + (e.errorText || '').trim());
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise((r) => {
        const to = setTimeout(r, ms);
        pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(to); r(); } };
      });
      pc.close();
      return { relay, errs: [...new Set(errs)] };
    }, { server: { urls: url, username, credential }, ms: 9000 });
    out.push(Object.assign({ url }, r));
    log(`${r.relay.length ? 'OK  ' : 'FAIL'} ${url.padEnd(56)} relay: ${r.relay.join(' ') || '-'}${r.errs.length ? '  errors: ' + r.errs.join('; ') : ''}`);
  }
  await b.close();
  return out;
}

// Wrap RTCPeerConnection before the page's scripts run: force relay-only and/or swap the ICE servers.
function initScript({ policy, servers }) {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.__iceErr = [];
  function Wrapped(cfg, ...rest) {
    cfg = Object.assign({}, cfg || {});
    if (policy) cfg.iceTransportPolicy = policy;
    if (servers) cfg.iceServers = servers;
    const pc = new Orig(cfg, ...rest);
    window.__pcs.push(pc);
    pc.addEventListener('icecandidateerror', (e) => window.__iceErr.push(e.errorCode + ' ' + (e.url || '')));
    return pc;
  }
  Wrapped.prototype = Orig.prototype;
  Object.setPrototypeOf(Wrapped, Orig);
  window.RTCPeerConnection = Wrapped;
}

async function pairInfo() {
  const out = [];
  for (const pc of window.__pcs || []) {
    const row = { ice: pc.iceConnectionState };
    try {
      const st = await pc.getStats();
      let id = null;
      st.forEach((s) => { if (s.type === 'transport' && s.selectedCandidatePairId) id = s.selectedCandidatePairId; });
      if (!id) st.forEach((s) => { if (s.type === 'candidate-pair' && s.state === 'succeeded' && (s.selected || s.nominated)) id = s.id; });
      const p = id && st.get(id);
      if (p) {
        const l = st.get(p.localCandidateId), r = st.get(p.remoteCandidateId);
        row.local = l && (l.candidateType + '/' + l.protocol + (l.relayProtocol ? '/' + l.relayProtocol : '') + (l.url ? ' ' + l.url : ''));
        row.remote = r && (r.candidateType + '/' + r.protocol);
      }
    } catch (e) { row.err = e.message; }
    out.push(row);
  }
  return out;
}

async function dcStats() {
  let msgs = 0, bytes = 0;
  for (const pc of window.__pcs || []) {
    if (pc.connectionState === 'closed') continue;
    try { (await pc.getStats()).forEach((s) => { if (s.type === 'data-channel') { msgs += s.messagesReceived || 0; bytes += s.bytesReceived || 0; } }); } catch (e) {}
  }
  return { msgs, bytes, t: performance.now() };
}

function uiInfo() {
  const m = document.getElementById('net-menu');
  const q = (s) => { const e = m && m.querySelector(s); return e ? e.textContent : null; };
  return { mode: window.Game && Game.Net && Game.Net.mode, menu: m && !m.hidden ? q('h1') + ' | ' + q('.msg') : 'hidden', dbg: q('.dbg'), iceErr: [...new Set(window.__iceErr || [])].slice(0, 8) };
}

async function e2e(c) {
  const res = { label: c.label, ok: false };
  const kinds = [...new Set([c.hostB || 'chrome', c.guestB || 'chrome'])];
  const browsers = {};
  try {
    for (const k of kinds) browsers[k] = await launch(k);
    const arg = { policy: c.policy || null, servers: c.servers || null };
    const hc = await browsers[c.hostB || 'chrome'].newContext();
    const gc = await browsers[c.guestB || 'chrome'].newContext();
    await hc.addInitScript(initScript, arg);
    await gc.addInitScript(initScript, arg);
    const host = await hc.newPage(), guest = await gc.newPage();
    const logs = [];
    for (const [n, p] of [['host', host], ['guest', guest]]) {
      p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${n}] ${m.text().slice(0, 240)}`); });
      p.on('pageerror', (e) => logs.push(`[${n} pageerror] ${e.message}`));
    }
    await host.goto(c.site, { waitUntil: 'load', timeout: 30000 });
    await host.click('#net-menu [data-a=host]', { timeout: 15000 });
    const code = (await (await host.waitForSelector('#net-menu .code', { timeout: 25000 })).textContent()).trim();
    const t0 = Date.now();
    await guest.goto(c.site + (c.site.includes('?') ? '&' : '?') + 'room=' + (c.badCode ? 'ZZZZ' : code), { waitUntil: 'load', timeout: 30000 });
    const wait = (p, fn) => p.waitForFunction(fn, null, { timeout: c.timeout || 50000, polling: 200 }).then(() => true, () => false);
    if (c.expectFail) {
      // Expect the guest to give up with a message (and see how long that takes).
      const shown = await wait(guest, () => { const m = document.getElementById('net-menu'); return Game.Net.mode === 'guest' || (!m.hidden && m.querySelector('h1').textContent === 'Arena 1v1' && m.querySelector('.msg').textContent.length > 0); });
      res.secs = +((Date.now() - t0) / 1000).toFixed(1);
      res.guestUi = await guest.evaluate(uiInfo);
      res.hostUi = await host.evaluate(uiInfo);
      res.ok = shown && res.guestUi.mode === 'local' && (!c.expectMsg || new RegExp(c.expectMsg).test(res.guestUi.menu));
      log(`${res.ok ? 'PASS' : 'FAIL'}  ${c.label}  (gave up after ${res.secs}s)`);
      log('      ' + JSON.stringify(Object.assign({}, res, { label: undefined })));
      return res;
    }
    const [h, g] = await Promise.all([
      wait(host, () => Game.Net.mode === 'host' && Game.Net.rtt != null),
      wait(guest, () => Game.Net.mode === 'guest' && Game.Net.lastSnapBytes > 0),
    ]);
    res.ok = h && g;
    res.secs = +((Date.now() - t0) / 1000).toFixed(1);
    res.guestLink = await guest.evaluate(pairInfo);
    res.guestUi = await guest.evaluate(uiInfo);
    res.hostUi = await host.evaluate(uiInfo);
    if (res.ok && c.play !== false) {
      await guest.keyboard.down('d');
      await sleep(500);
      res.inputReachesHost = await host.evaluate(() => Game.Input.isDown(Game.CONFIG.PLAYERS[1].keys.right));
      await guest.keyboard.up('d');
      await host.keyboard.press('Space');
      await guest.keyboard.press('Space');
      res.matchStarted = await guest.waitForFunction(() => Game.state.phase === 'playing', null, { timeout: 15000 }).then(() => true, () => false);
      const s0 = await guest.evaluate(dcStats);
      for (const k of ['Space', 'd']) await guest.keyboard.down(k);
      for (const k of ['Space', 's']) await host.keyboard.down(k);
      await sleep(4000);
      const s1 = await guest.evaluate(dcStats);
      for (const k of ['Space', 'd']) await guest.keyboard.up(k);
      for (const k of ['Space', 's']) await host.keyboard.up(k);
      const dt = (s1.t - s0.t) / 1000;
      res.snapsPerSec = +((s1.msgs - s0.msgs) / dt).toFixed(1);
      res.kbPerSec = Math.round((s1.bytes - s0.bytes) / 1024 / dt);
      res.snapBytes = await guest.evaluate(() => Game.Net.lastSnapBytes);
      res.pingMs = await host.evaluate(() => Game.Net.rtt);
    }
    res.logs = logs.filter((l) => !/favicon/.test(l)).slice(0, 12);
  } catch (e) { res.err = e.message.split('\n')[0]; }
  finally { for (const b of Object.values(browsers)) await b.close().catch(() => {}); }
  log(`${res.ok ? 'PASS' : 'FAIL'}  ${c.label}${res.secs != null ? `  (${res.secs}s)` : ''}`);
  log('      ' + JSON.stringify(Object.assign({}, res, { label: undefined })));
  return res;
}

function iceList(results) {
  // Working TURN URLs grouped by credentials, plus STUN.
  const groups = new Map();
  for (const r of results) {
    if (!r.ok || (r.transport === 'tls' && r.certOk === false)) continue;
    const [, [u, p]] = TURN.find(([url]) => url === r.url);
    const k = u + '\n' + p;
    if (!groups.has(k)) groups.set(k, { urls: [], username: u, credential: p });
    groups.get(k).urls.push(r.url);
  }
  return [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }, ...groups.values()];
}

(async () => {
  if (step('site')) {
    log('== signalling server and live site');
    try {
      const r = await fetch('https://0.peerjs.com/peerjs/id?ts=' + Date.now());
      report.broker = r.status + ' ' + (await r.text()).slice(0, 60);
    } catch (e) { report.broker = 'ERR ' + e.message; }
    try {
      const t = await (await fetch(LIVE.replace(/\?.*$/, '') + 'net.js?v=5&cb=' + Date.now())).text();
      report.liveVersion = (/VERSION = '([^']+)'/.exec(t) || [])[1];
    } catch (e) { report.liveVersion = 'ERR ' + e.message; }
    log('broker:', report.broker, '| live net.js version:', report.liveVersion);
    // Double-check the relay hostnames against public DNS (not just this runner's resolver).
    report.doh = {};
    for (const h of ['eu-0.turn.peerjs.com', 'us-0.turn.peerjs.com', 'openrelay.metered.ca', 'staticauth.openrelay.metered.ca', 'freeturn.net', '0.peerjs.com']) {
      const row = [];
      for (const [name, url] of [['google', 'https://dns.google/resolve?type=A&name='], ['cloudflare', 'https://cloudflare-dns.com/dns-query?type=A&name=']]) {
        try {
          const j = await (await fetch(url + h, { headers: { accept: 'application/dns-json' } })).json();
          row.push(name + ': ' + (j.Status === 3 ? 'NXDOMAIN' : (j.Answer || []).filter((a) => a.type === 1).map((a) => a.data).join(',') || 'no A record (status ' + j.Status + ')'));
        } catch (e) { row.push(name + ': ERR ' + e.message); }
      }
      report.doh[h] = row.join(' | ');
      log('DNS', h.padEnd(34), report.doh[h]);
    }
  }

  let raw = [];
  if (step('raw')) {
    log('\n== STUN binding');
    report.stun = [];
    for (const u of STUN) { const r = await testStun(u); report.stun.push(r); log(`${r.ok ? 'OK  ' : 'FAIL'} ${u.padEnd(40)} ${r.ok ? 'public ' + r.mapped : r.err} (${r.ip})`); }
    log('\n== TURN allocate (real credentials check)');
    for (const [url, [u, p], tag] of TURN) {
      const r = await testTurn(url, u, p);
      r.inLiveConfig = !!tag;
      raw.push(r);
      const what = r.ok ? `relay ${r.relayed}` + (r.transport === 'tls' ? ` cert ${r.certOk ? 'valid' : 'INVALID ' + r.certErr}` : '') : `${r.stage}: ${r.err}`;
      log(`${r.ok ? 'OK  ' : 'FAIL'} ${tag ? '[live] ' : '       '}${url.padEnd(56)} ${what} (${r.ip}${r.realm ? ', realm ' + r.realm : ''}, ${r.ms}ms)`);
    }
    report.turn = raw;
  }

  if (step('gather')) {
    log('\n== Chrome ICE gathering per TURN server (relay-only)');
    report.gather = await gatherAll();
  }

  if (step('selftest') && (LOCAL || process.env.SELFTEST_SITE)) {
    log('\n== "Test my connection" button');
    const b = await launch('chrome');
    const page = await b.newPage();
    await page.goto(process.env.SELFTEST_SITE || LOCAL, { waitUntil: 'load' });
    await page.click('#net-menu [data-a=check]');
    await page.waitForFunction(() => /Routes:/.test(document.querySelector('#net-menu .msg').textContent), null, { timeout: 25000 }).catch(() => {});
    report.selftest = await page.evaluate(() => document.querySelector('#net-menu .msg').textContent);
    log(report.selftest);
    await b.close();
  }

  if (step('e2e')) {
    const working = raw.length ? iceList(raw) : null;
    report.workingIce = working;
    log('\n== Two browsers through the real site + broker');
    log('working set: ' + JSON.stringify(working));
    const cases = [];
    const add = (net, label, extra) => cases.push(Object.assign({ net, label }, extra));
    const SETS = (process.env.SETS || 'live,working,branch').split(',');
    if (SETS.includes('live')) {
    add('open', 'live v5 | direct allowed', { site: LIVE });
    add('open', 'live v5 | relay only (devices isolated)', { site: LIVE, policy: 'relay' });
    add('noudp', 'live v5 | relay only + UDP blocked', { site: LIVE, policy: 'relay' });
    add('webonly', 'live v5 | relay only + only ports 80/443', { site: LIVE, policy: 'relay' });
    add('open', 'live v5 | chrome host + firefox guest | relay only', { site: LIVE, policy: 'relay', guestB: 'firefox' });
    }
    if (SETS.includes('working') && working && working.length > 1) {
      add('open', 'working set | relay only', { site: LIVE, policy: 'relay', servers: working });
      add('noudp', 'working set | relay only + UDP blocked', { site: LIVE, policy: 'relay', servers: working });
      add('webonly', 'working set | relay only + only ports 80/443', { site: LIVE, policy: 'relay', servers: working });
    }
    if (LOCAL && SETS.includes('branch')) {
      add('open', 'branch | direct allowed', { site: LOCAL });
      add('open', 'branch | chrome host + firefox guest | direct', { site: LOCAL, guestB: 'firefox' });
      add('open', 'branch | firefox host + chrome guest | direct', { site: LOCAL, hostB: 'firefox' });
      add('open', 'branch | wrong room code -> clear message', { site: LOCAL, badCode: true, expectFail: true, expectMsg: 'No room with code' });
      if (process.env.BRANCH_HAS_RELAY === '1') {
        add('open', 'branch | relay only', { site: LOCAL, policy: 'relay' });
        add('noudp', 'branch | relay only + UDP blocked', { site: LOCAL, policy: 'relay' });
        add('webonly', 'branch | relay only + only ports 80/443', { site: LOCAL, policy: 'relay' });
        add('open', 'branch | chrome host + firefox guest | relay only', { site: LOCAL, policy: 'relay', guestB: 'firefox' });
        add('webonly', 'branch | firefox host + chrome guest | relay + 80/443', { site: LOCAL, policy: 'relay', hostB: 'firefox' });
      } else {
        add('open', 'branch | relay only, no relay set up -> honest message', { site: LOCAL, policy: 'relay', expectFail: true, expectMsg: 'no relay server set up' });
      }
    }
    report.e2e = [];
    let cur = null;
    for (const c of cases) {
      if (c.net !== cur) { setNet(c.net); cur = c.net; }
      report.e2e.push(await e2e(c));
    }
    setNet('open');
    log('\n== Summary');
    for (const r of report.e2e) {
      if (!r.guestLink) { log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}  ${r.secs}s: ${(r.guestUi && r.guestUi.menu) || r.err || ''}`); continue; }
      log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? `  ${r.secs}s, ${(r.guestLink.find((x) => x.local) || {}).local || ''}, ${r.snapsPerSec || '?'} snaps/s, ${r.kbPerSec || '?'} KB/s, ping ${r.pingMs}ms` : '  ' + ((r.guestUi && r.guestUi.dbg) || r.err || '')}`);
    }
  }
  fs.writeFileSync('netcheck-report.json', JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); setNet('open'); process.exit(1); });
