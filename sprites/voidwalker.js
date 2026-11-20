// Voidwalker top-down sprite: pointed hood, magenta-cracked pauldrons, rippling cloak, orbiting shards, void blade.
Game.Sprites.register('voidwalker', function (ctx, a) {
  const r = a.r, t = a.t, mv = a.move, atk = a.attack;
  const TAU = Math.PI * 2;
  const fl = a.flash;
  const C = fl
    ? { cloak: '#ffffff', cloak2: '#e8e8ff', hood: '#ffffff', hood2: '#f0f0ff', plate: '#ffffff', edge: '#ffffff', out: '#ffffff' }
    : { cloak: '#2a1650', cloak2: '#4a2a86', hood: '#3b1f72', hood2: '#1d0e3d', plate: '#2f1a5c', edge: '#b66bff', out: '#07030f' };
  const pulse = 0.75 + 0.25 * Math.sin(t * 3);

  function outline(w) { ctx.lineWidth = w || 1.5; ctx.strokeStyle = C.out; ctx.lineJoin = 'round'; ctx.stroke(); }

  ctx.save();
  ctx.lineJoin = 'round';

  // Soft violet aura so the dark body reads on the floor
  const ag = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.7);
  ag.addColorStop(0, 'rgba(150,80,255,0.35)');
  ag.addColorStop(1, 'rgba(150,80,255,0)');
  ctx.fillStyle = ag;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill();

  // ---- Cloak trailing behind (-x), rippling ----
  const len = r * (0.95 + 0.3 * mv);
  const rip = (k) => Math.sin(a.walk * 1.3 + k) * r * 0.18 * (0.25 + mv) + Math.sin(t * 2 + k * 1.7) * r * 0.08;
  const pts = [];
  const N = 6;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const y = (u - 0.5) * r * 2.1;
    const tail = len * (1 - Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.55) + (i % 2 ? r * 0.1 : -r * 0.03);
    pts.push([-r * 0.2 - tail, y + rip(i)]);
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.95);
  for (let i = 0; i <= N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineTo(-r * 0.1, r * 0.95);
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, 0, -r * 2.4, 0);
  cg.addColorStop(0, C.cloak2); cg.addColorStop(1, C.cloak);
  ctx.fillStyle = cg; ctx.fill(); outline(1.6);
  // hem glow in team color
  ctx.beginPath();
  for (let i = 0; i <= N; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = fl ? '#fff' : a.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
  // cloak folds
  ctx.strokeStyle = fl ? '#ccd' : 'rgba(182,107,255,0.55)'; ctx.lineWidth = 1;
  for (let i = 1; i < N; i += 1) {
    ctx.beginPath(); ctx.moveTo(-r * 0.3, (i / N - 0.5) * r * 1.4);
    ctx.lineTo(pts[i][0] * 0.8, pts[i][1] * 0.85); ctx.stroke();
  }

  // ---- Arms/pauldrons ----
  const swing = Math.sin(a.walk) * mv * r * 0.18;
  const sl = -atk; // slash progress inverse
  function pauldron(side, fwd) {
    ctx.save();
    ctx.translate(fwd, side * r * 0.64);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.3, side * 0.3, 0, TAU);
    ctx.fillStyle = C.plate; ctx.fill(); outline(1.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.3, side * 0.3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.strokeStyle = C.edge; ctx.lineWidth = 1.6; ctx.stroke();
    // team trim
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.3, r * 0.2, side * 0.3, Math.PI * 0.2, Math.PI * 0.8);
    ctx.strokeStyle = fl ? '#fff' : a.color; ctx.lineWidth = 1.6; ctx.stroke();
    // rift crack
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, -r * 0.1); ctx.lineTo(-r * 0.05, r * 0.02); ctx.lineTo(-r * 0.1, r * 0.12); ctx.lineTo(r * 0.15, r * 0.2);
    ctx.strokeStyle = fl ? '#fff' : '#ff3df0'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  }

  // trailing (left, -y) arm
  ctx.save();
  ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.6); ctx.lineTo(r * 0.5 - swing, -r * 0.6); ctx.lineWidth = r * 0.42;
  ctx.lineCap = 'round'; ctx.strokeStyle = C.out; ctx.stroke();
  ctx.lineWidth = r * 0.3; ctx.strokeStyle = C.hood; ctx.stroke();
  ctx.restore();
  pauldron(-1, r * 0.05 + swing * 0.5);

  // ---- Blade arm (right, +y), slashes on attack ----
  const ext = atk;                          // 1 -> 0
  const ang = -ext * 0.9 + 0.15;            // sweeps across the front
  const hx = r * 0.5 + ext * r * 0.15 - swing * 0.6, hy = r * 0.6 - ext * r * 0.6;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(r * 0.05, r * 0.62); ctx.lineTo(hx, hy);
  ctx.lineCap = 'round'; ctx.lineWidth = r * 0.44; ctx.strokeStyle = C.out; ctx.stroke();
  ctx.lineWidth = r * 0.32; ctx.strokeStyle = C.hood; ctx.stroke();
  ctx.restore();
  // blade
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(ang);
  const bl = r * (0.8 + 0.1 * ext);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.1); ctx.lineTo(bl * 0.8, -r * 0.16); ctx.lineTo(bl * 1.05, 0);
  ctx.lineTo(bl * 0.8, r * 0.12); ctx.lineTo(-r * 0.1, r * 0.1); ctx.closePath();
  const bg = ctx.createLinearGradient(0, 0, bl, 0);
  bg.addColorStop(0, fl ? '#fff' : '#7a3dd8'); bg.addColorStop(1, fl ? '#fff' : '#e6b8ff');
  ctx.fillStyle = bg; ctx.fill(); outline(1.4);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bl, 0);
  ctx.strokeStyle = fl ? '#fff' : '#fff0ff'; ctx.lineWidth = 1; ctx.stroke();
  // clawed fist guard
  ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fillStyle = C.plate; ctx.fill(); outline(1.3);
  ctx.restore();
  pauldron(1, r * 0.05 + ext * r * 0.15 - swing * 0.5);

  // slash arc
  if (atk > 0.02) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, atk * 1.2);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, -0.95, 0.95);
    ctx.arc(0, 0, r * 1.1, 0.95, -0.95, true);
    ctx.closePath();
    ctx.fillStyle = fl ? '#fff' : 'rgba(205,140,255,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r * 1.55, -0.95, 0.95);
    ctx.strokeStyle = '#ff7df5'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  // ---- Body / shoulders mass ----
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.8, r * 0.95, 0, 0, TAU);
  ctx.fillStyle = C.cloak2; ctx.fill(); outline(1.6);

  // ---- Pointed hood (point trails back toward -x) ----
  ctx.beginPath();
  ctx.moveTo(-r * 1.15, 0);
  ctx.quadraticCurveTo(-r * 0.6, -r * 0.62, r * 0.1, -r * 0.7);
  ctx.quadraticCurveTo(r * 0.8, -r * 0.62, r * 0.82, 0);
  ctx.quadraticCurveTo(r * 0.8, r * 0.62, r * 0.1, r * 0.7);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.62, -r * 1.15, 0);
  ctx.closePath();
  const hg = ctx.createRadialGradient(r * 0.2, 0, r * 0.1, -r * 0.1, 0, r * 1.1);
  hg.addColorStop(0, C.hood); hg.addColorStop(1, C.hood2);
  ctx.fillStyle = hg; ctx.fill(); outline(1.7);
  // violet rim light on hood edge
  ctx.beginPath();
  ctx.moveTo(-r * 1.05, 0);
  ctx.quadraticCurveTo(-r * 0.6, -r * 0.58, r * 0.1, -r * 0.66);
  ctx.quadraticCurveTo(r * 0.7, -r * 0.6, r * 0.76, -r * 0.2);
  ctx.strokeStyle = C.edge; ctx.lineWidth = 1.3; ctx.stroke();
  // ridge seam
  ctx.beginPath(); ctx.moveTo(-r * 1.05, 0); ctx.lineTo(r * 0.2, 0);
  ctx.strokeStyle = fl ? '#ccc' : 'rgba(10,4,25,0.7)'; ctx.lineWidth = 1; ctx.stroke();
  // face opening shadow
  ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.28, r * 0.42, 0, 0, TAU);
  ctx.fillStyle = fl ? '#bbb' : '#0a0418'; ctx.fill();

  // eyes
  const eye = a.stunned ? 0.18 : pulse;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(r * 0.68, s * r * 0.17);
    ctx.rotate(s * -0.25);
    ctx.globalAlpha = eye;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.17, r * 0.07, 0, 0, TAU);
    ctx.shadowColor = '#c46bff'; ctx.shadowBlur = a.stunned ? 0 : 6;
    ctx.fillStyle = fl ? '#fff' : '#e9b8ff'; ctx.fill();
    ctx.restore();
  }

  // ---- Orbiting shards ----
  for (let i = 0; i < 4; i++) {
    const an = t * 0.9 + i * TAU / 4;
    const d = r * (1.0 + 0.08 * Math.sin(t * 2 + i));
    ctx.save();
    ctx.translate(Math.cos(an) * d, Math.sin(an) * d);
    ctx.rotate(an + t);
    ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(0, r * 0.09); ctx.lineTo(-r * 0.12, 0); ctx.lineTo(0, -r * 0.09); ctx.closePath();
    ctx.fillStyle = fl ? '#fff' : '#c58bff'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = C.out; ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
});
