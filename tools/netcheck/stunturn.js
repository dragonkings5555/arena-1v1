// Minimal STUN/TURN client (RFC 5389 / 5766) for checking servers without a browser.
// testTurn() does a real Allocate with long-term credentials over UDP, TCP or TLS and reports
// the relayed address, or the exact error (e.g. 401 wrong credentials, timeout, connection refused).
const dgram = require('dgram');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const dns = require('dns').promises;

const MAGIC = 0x2112a442;
const A = { MAPPED: 0x0001, USERNAME: 0x0006, INTEGRITY: 0x0008, ERROR: 0x0009, LIFETIME: 0x000d,
  REALM: 0x0014, NONCE: 0x0015, XOR_RELAYED: 0x0016, TRANSPORT: 0x0019, XOR_MAPPED: 0x0020 };

function attr(type, value) {
  const pad = (4 - (value.length % 4)) % 4;
  const b = Buffer.alloc(4 + value.length + pad);
  b.writeUInt16BE(type, 0);
  b.writeUInt16BE(value.length, 2);
  value.copy(b, 4);
  return b;
}

function build(type, attrs, key, fixedTid) {
  const tid = fixedTid || crypto.randomBytes(12);
  let body = Buffer.concat(attrs);
  const h = Buffer.alloc(20);
  h.writeUInt16BE(type, 0);
  h.writeUInt32BE(MAGIC, 4);
  tid.copy(h, 8);
  if (key) {
    h.writeUInt16BE(body.length + 24, 2);
    const mac = crypto.createHmac('sha1', key).update(Buffer.concat([h, body])).digest();
    body = Buffer.concat([body, attr(A.INTEGRITY, mac)]);
  }
  h.writeUInt16BE(body.length, 2);
  return Buffer.concat([h, body]);
}

function parse(buf) {
  if (buf.length < 20 || buf.readUInt32BE(4) !== MAGIC) return null;
  const len = buf.readUInt16BE(2);
  const m = { type: buf.readUInt16BE(0), tid: buf.subarray(8, 20), attrs: {} };
  let off = 20;
  while (off + 4 <= Math.min(buf.length, 20 + len)) {
    const t = buf.readUInt16BE(off), l = buf.readUInt16BE(off + 2);
    if (!(t in m.attrs)) m.attrs[t] = buf.subarray(off + 4, off + 4 + l);
    off += 4 + l + ((4 - (l % 4)) % 4);
  }
  return m;
}

function xorAddr(v, tid) {
  if (!v) return null;
  const port = v.readUInt16BE(2) ^ (MAGIC >>> 16);
  if (v[1] === 1) return [0, 1, 2, 3].map((i) => v[4 + i] ^ ((MAGIC >>> (24 - 8 * i)) & 0xff)).join('.') + ':' + port;
  return 'ipv6:' + port;
}
function plainAddr(v) { return v && v[1] === 1 ? [4, 5, 6, 7].map((i) => v[i]).join('.') + ':' + v.readUInt16BE(2) : null; }
function errText(v) { return v ? ((v[2] & 7) * 100 + v[3]) + ' ' + v.subarray(4).toString('utf8') : null; }

// One connection to a server; request() sends a message and resolves with the matching response.
function open(transport, host, port, ms) {
  return new Promise((resolve, reject) => {
    const pending = new Map();
    const onMsg = (buf) => {
      const m = parse(buf);
      if (!m) return;
      const p = pending.get(m.tid.toString('hex'));
      if (p) { pending.delete(m.tid.toString('hex')); clearInterval(p.rt); clearTimeout(p.to); p.res(m); }
    };
    const wait = (msg, send, rtMs, toMs) => new Promise((res, rej) => {
      const k = msg.subarray(8, 20).toString('hex');
      send();
      const rt = rtMs ? setInterval(send, rtMs) : null;
      const to = setTimeout(() => { pending.delete(k); clearInterval(rt); rej(new Error('no reply in ' + toMs + 'ms')); }, toMs);
      pending.set(k, { res, rt, to });
    });
    if (transport === 'udp') {
      const s = dgram.createSocket('udp4');
      s.on('message', onMsg);
      s.on('error', () => {});
      s.bind(0, () => resolve({
        request: (msg, toMs = 5000) => wait(msg, () => s.send(msg, port, host), 600, toMs),
        close: () => { try { s.close(); } catch (e) {} },
      }));
      return;
    }
    const o = { host, port, servername: host, rejectUnauthorized: false };
    const sock = transport === 'tls' ? tls.connect(o) : net.connect(o);
    let buf = Buffer.alloc(0), up = false;
    const to = setTimeout(() => { if (!up) { sock.destroy(); reject(new Error('connect timeout')); } }, ms || 7000);
    sock.on(transport === 'tls' ? 'secureConnect' : 'connect', () => {
      up = true; clearTimeout(to);
      const info = transport === 'tls' ? { certOk: sock.authorized, certErr: sock.authorizationError || null } : {};
      resolve(Object.assign(info, {
        request: (msg, toMs = 6000) => wait(msg, () => sock.write(msg), 0, toMs),
        close: () => sock.destroy(),
      }));
    });
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 20) {
        const n = buf.readUInt16BE(2) + 20;
        if (buf.length < n) break;
        onMsg(buf.subarray(0, n));
        buf = buf.subarray(n);
      }
    });
    sock.on('error', (e) => { if (!up) { clearTimeout(to); reject(e); } });
  });
}

function parseUrl(url) {
  const m = /^(stuns?|turns?):([^:?]+)(?::(\d+))?(?:\?transport=(udp|tcp))?$/.exec(url);
  if (!m) throw new Error('bad url ' + url);
  const scheme = m[1], tlsScheme = scheme.endsWith('s');
  return { scheme, host: m[2], port: +(m[3] || (tlsScheme ? 5349 : 3478)), transport: tlsScheme ? 'tls' : (m[4] || 'udp') };
}

async function resolveHost(host) {
  try { return (await dns.lookup(host, { all: true, family: 4 })).map((a) => a.address).join(','); }
  catch (e) { return 'DNS ' + e.code; }
}

async function testStun(url) {
  const u = parseUrl(url), t0 = Date.now();
  const r = { url, ip: await resolveHost(u.host) };
  if (r.ip.startsWith('DNS')) return Object.assign(r, { ok: false, err: r.ip });
  let s;
  try {
    s = await open(u.transport, u.host, u.port);
    const m = await s.request(build(0x0001, []), 4000);
    r.ok = m.type === 0x0101;
    r.mapped = xorAddr(m.attrs[A.XOR_MAPPED], m.tid) || plainAddr(m.attrs[A.MAPPED]);
  } catch (e) { r.ok = false; r.err = e.code || e.message; }
  finally { if (s) s.close(); }
  r.ms = Date.now() - t0;
  return r;
}

async function testTurn(url, username, credential) {
  const u = parseUrl(url), t0 = Date.now();
  const r = { url, transport: u.transport, ip: await resolveHost(u.host) };
  if (r.ip.startsWith('DNS')) return Object.assign(r, { ok: false, stage: 'dns', err: r.ip });
  let s;
  try {
    s = await open(u.transport, u.host, u.port);
    if (u.transport === 'tls') { r.certOk = s.certOk; r.certErr = s.certErr; }
  } catch (e) { return Object.assign(r, { ok: false, stage: 'connect', err: e.code || e.message, ms: Date.now() - t0 }); }
  try {
    const want = attr(A.TRANSPORT, Buffer.from([17, 0, 0, 0]));
    const m1 = await s.request(build(0x0003, [want]));
    if (m1.type === 0x0103) return Object.assign(r, { ok: true, note: 'allocated without credentials', relayed: xorAddr(m1.attrs[A.XOR_RELAYED], m1.tid) });
    if (!m1.attrs[A.REALM] || !m1.attrs[A.NONCE]) return Object.assign(r, { ok: false, stage: 'challenge', err: errText(m1.attrs[A.ERROR]) || 'type 0x' + m1.type.toString(16) });
    const realm = m1.attrs[A.REALM], nonce = m1.attrs[A.NONCE];
    r.realm = realm.toString('utf8');
    const key = crypto.createHash('md5').update(username + ':' + r.realm + ':' + credential).digest();
    const auth = [attr(A.USERNAME, Buffer.from(username, 'utf8')), attr(A.REALM, realm), attr(A.NONCE, nonce)];
    const m2 = await s.request(build(0x0003, [want].concat(auth), key));
    if (m2.type === 0x0103) {
      r.ok = true;
      r.relayed = xorAddr(m2.attrs[A.XOR_RELAYED], m2.tid);
      r.mapped = xorAddr(m2.attrs[A.XOR_MAPPED], m2.tid);
      // Free the allocation again (Refresh with lifetime 0).
      try { await s.request(build(0x0004, [attr(A.LIFETIME, Buffer.alloc(4))].concat(auth), key), 2000); } catch (e) {}
    } else {
      r.ok = false; r.stage = 'auth'; r.err = errText(m2.attrs[A.ERROR]) || 'type 0x' + m2.type.toString(16);
    }
  } catch (e) { r.ok = false; r.stage = r.stage || 'allocate'; r.err = e.code || e.message; }
  finally { s.close(); }
  r.ms = Date.now() - t0;
  return r;
}

module.exports = { testStun, testTurn, parseUrl, _build: build, _attr: attr, _parse: parse, _xorAddr: xorAddr };
