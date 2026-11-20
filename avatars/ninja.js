// NINJA portrait: hooded, masked, headband tails, raised kunai, teal energy orb.
Game.Avatars.register('ninja', function (ctx, s, opts) {
  const t = opts.t || 0;
  const col = opts.color || '#4fc3f7';
  const lw = s * 0.012;
  const TEAL = '#28e6d2', TEAL_D = '#0a8f93';
  const poly = (pts, fill, stroke) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * s, pts[i][1] * s);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
  };
  const OUT = '#05070f';
  ctx.save();

  // Background
  let g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#0b1535'); g.addColorStop(1, '#04060f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  g = ctx.createRadialGradient(s * 0.3, s * 0.72, 0, s * 0.3, s * 0.72, s * 0.6);
  g.addColorStop(0, 'rgba(40,230,210,0.28)'); g.addColorStop(1, 'rgba(40,230,210,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  g = ctx.createRadialGradient(s * 0.5, s * 0.4, s * 0.1, s * 0.5, s * 0.4, s * 0.75);
  g.addColorStop(0, 'rgba(60,90,200,0.25)'); g.addColorStop(1, 'rgba(60,90,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  // moon
  ctx.fillStyle = 'rgba(190,215,255,0.16)';
  ctx.beginPath(); ctx.arc(s * 0.82, s * 0.16, s * 0.07, 0, 7); ctx.fill();
  // player-color rim light (right edge)
  g = ctx.createLinearGradient(s, 0, s * 0.7, 0);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.28; ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); ctx.globalAlpha = 1;

  // Headband tails (behind head), swaying
  const sw = Math.sin(t * 2.2), sw2 = Math.sin(t * 2.2 + 1.1);
  const tail = (y0, dx, dy, w, sway, fill) => {
    ctx.beginPath();
    ctx.moveTo(0.3 * s, y0 * s);
    ctx.bezierCurveTo((0.2) * s, (y0 + 0.03) * s, (0.12 + dx * 0.4) * s, (y0 + dy * 0.2 + sway * 0.01) * s, (0.02 + dx) * s, (y0 + dy + sway * 0.03) * s);
    ctx.lineTo((0.05 + dx) * s, (y0 + dy + w + sway * 0.03) * s);
    ctx.bezierCurveTo((0.15 + dx * 0.4) * s, (y0 + dy * 0.3 + w + sway * 0.01) * s, 0.22 * s, (y0 + w + 0.01) * s, 0.31 * s, (y0 + w) * s);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  };
  tail(0.3, 0.0, 0.2, 0.065, sw2, '#0d6f78');
  tail(0.29, 0.02, 0.07, 0.065, sw, TEAL_D);

  // Shoulders / torso
  const body = ctx.createLinearGradient(0, s * 0.72, 0, s);
  body.addColorStop(0, '#1d2747'); body.addColorStop(1, '#0d1226');
  ctx.beginPath();
  ctx.moveTo(0.02 * s, s * 1.01);
  ctx.bezierCurveTo(0.03 * s, 0.82 * s, 0.14 * s, 0.73 * s, 0.32 * s, 0.7 * s);
  ctx.lineTo(0.68 * s, 0.7 * s);
  ctx.bezierCurveTo(0.88 * s, 0.73 * s, 0.98 * s, 0.82 * s, 0.99 * s, s * 1.01);
  ctx.closePath();
  ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  // shadow side (left)
  ctx.beginPath();
  ctx.moveTo(0.02 * s, s * 1.01);
  ctx.bezierCurveTo(0.03 * s, 0.82 * s, 0.14 * s, 0.73 * s, 0.32 * s, 0.7 * s);
  ctx.lineTo(0.3 * s, 0.82 * s); ctx.lineTo(0.2 * s, s * 1.01); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,10,0.35)'; ctx.fill();
  // cross-wrap chest strap + collar
  poly([[0.34, 0.7], [0.46, 0.7], [0.72, 1.01], [0.58, 1.01]], '#2b3866', OUT);
  poly([[0.52, 0.7], [0.62, 0.7], [0.9, 1.01], [0.8, 1.01]], '#161d38', null);
  // shoulder armor plate (far left) w/ teal edge
  poly([[0.05, 0.9], [0.1, 0.8], [0.22, 0.75], [0.25, 0.83], [0.16, 0.92]], '#4a5675', OUT);
  poly([[0.1, 0.8], [0.22, 0.75], [0.225, 0.775], [0.12, 0.825]], '#8ea0c4', null);

  // Neck
  poly([[0.34, 0.6], [0.62, 0.6], [0.66, 0.74], [0.3, 0.74]], '#0f1530', OUT);

  // Hood / head
  const hx = 0.48, hy = 0.4;
  const hg = ctx.createLinearGradient(0.2 * s, 0, 0.75 * s, 0);
  hg.addColorStop(0, '#141b38'); hg.addColorStop(0.6, '#25315c'); hg.addColorStop(1, '#2f3f75');
  ctx.beginPath();
  ctx.moveTo(0.26 * s, 0.38 * s);
  ctx.bezierCurveTo(0.22 * s, 0.14 * s, 0.4 * s, 0.1 * s, 0.52 * s, 0.12 * s);
  ctx.bezierCurveTo(0.7 * s, 0.14 * s, 0.76 * s, 0.3 * s, 0.74 * s, 0.46 * s);
  ctx.bezierCurveTo(0.73 * s, 0.6 * s, 0.62 * s, 0.7 * s, 0.5 * s, 0.7 * s);
  ctx.bezierCurveTo(0.36 * s, 0.7 * s, 0.27 * s, 0.58 * s, 0.26 * s, 0.38 * s);
  ctx.closePath();
  ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.2; ctx.stroke();
  // hood peak tip at back
  poly([[0.28, 0.26], [0.2, 0.2], [0.3, 0.2]], '#141b38', OUT);

  // Eye band (skin strip), slanted
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0.35 * s, 0.35 * s);
  ctx.bezierCurveTo(0.45 * s, 0.33 * s, 0.62 * s, 0.34 * s, 0.73 * s, 0.35 * s);
  ctx.lineTo(0.74 * s, 0.46 * s);
  ctx.bezierCurveTo(0.62 * s, 0.5 * s, 0.46 * s, 0.5 * s, 0.34 * s, 0.47 * s);
  ctx.closePath();
  ctx.fillStyle = '#c8946a'; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  ctx.clip();
  ctx.fillStyle = 'rgba(60,20,10,0.3)'; ctx.fillRect(0.3 * s, 0.43 * s, 0.5 * s, 0.1 * s);
  ctx.restore();

  // Eyes (near eye bigger/right-shifted, far eye narrower)
  const eye = (cx, cy, w, h, tilt) => {
    ctx.save(); ctx.translate(cx * s, cy * s); ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(-w * s, h * s * 0.3);
    ctx.quadraticCurveTo(0, -h * s * 1.3, w * s, -h * s * 0.2);
    ctx.quadraticCurveTo(0, h * s * 1.0, -w * s, h * s * 0.3);
    ctx.fillStyle = '#f2fbff'; ctx.fill();
    ctx.clip();
    ctx.fillStyle = TEAL;
    ctx.beginPath(); ctx.arc(w * s * 0.25, 0, h * s * 0.85, 0, 7); ctx.fill();
    ctx.fillStyle = '#021a22';
    ctx.beginPath(); ctx.arc(w * s * 0.3, 0, h * s * 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(w * s * 0.05, -h * s * 0.5, h * s * 0.3, h * s * 0.3);
    ctx.restore();
    ctx.save(); ctx.translate(cx * s, cy * s); ctx.rotate(tilt);
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.1;
    ctx.beginPath();
    ctx.moveTo(-w * s * 1.05, h * s * 0.3);
    ctx.quadraticCurveTo(0, -h * s * 1.4, w * s * 1.05, -h * s * 0.2);
    ctx.stroke();
    ctx.restore();
  };
  eye(0.47, 0.415, 0.075, 0.034, 0.16);
  eye(0.66, 0.41, 0.065, 0.032, 0.16);
  // brows
  ctx.strokeStyle = '#1a0e0c'; ctx.lineWidth = s * 0.02; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.38 * s, 0.345 * s); ctx.lineTo(0.55 * s, 0.38 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.6 * s, 0.375 * s); ctx.lineTo(0.73 * s, 0.375 * s); ctx.stroke();
  ctx.lineCap = 'butt';

  // Headband (over forehead), angled
  ctx.beginPath();
  ctx.moveTo(0.25 * s, 0.27 * s);
  ctx.bezierCurveTo(0.4 * s, 0.22 * s, 0.62 * s, 0.22 * s, 0.75 * s, 0.31 * s);
  ctx.lineTo(0.745 * s, 0.355 * s);
  ctx.bezierCurveTo(0.62 * s, 0.27 * s, 0.4 * s, 0.27 * s, 0.26 * s, 0.33 * s);
  ctx.closePath();
  ctx.fillStyle = TEAL_D; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  // plate
  poly([[0.46, 0.235], [0.6, 0.245], [0.6, 0.3], [0.46, 0.29]], '#aab8d4', OUT);
  poly([[0.46, 0.235], [0.6, 0.245], [0.6, 0.262], [0.46, 0.252]], '#e2ebfa', null);
  ctx.fillStyle = TEAL; ctx.beginPath(); ctx.arc(0.53 * s, 0.272 * s, s * 0.014, 0, 7); ctx.fill();

  // Face mask (lower face) with nose ridge
  ctx.beginPath();
  ctx.moveTo(0.34 * s, 0.47 * s);
  ctx.bezierCurveTo(0.46 * s, 0.505 * s, 0.62 * s, 0.5 * s, 0.745 * s, 0.455 * s);
  ctx.bezierCurveTo(0.74 * s, 0.6 * s, 0.64 * s, 0.7 * s, 0.5 * s, 0.7 * s);
  ctx.bezierCurveTo(0.4 * s, 0.68 * s, 0.34 * s, 0.6 * s, 0.34 * s, 0.47 * s);
  ctx.closePath();
  const mg = ctx.createLinearGradient(0.3 * s, 0, 0.75 * s, 0);
  mg.addColorStop(0, '#0c1128'); mg.addColorStop(1, '#222d58');
  ctx.fillStyle = mg; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  // nose bridge highlight + wrap fold lines
  ctx.strokeStyle = 'rgba(120,150,230,0.35)'; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(0.58 * s, 0.49 * s); ctx.quadraticCurveTo(0.66 * s, 0.53 * s, 0.7 * s, 0.5 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.4 * s, 0.56 * s); ctx.quadraticCurveTo(0.55 * s, 0.62 * s, 0.7 * s, 0.56 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,10,0.5)';
  ctx.beginPath(); ctx.moveTo(0.42 * s, 0.62 * s); ctx.quadraticCurveTo(0.52 * s, 0.67 * s, 0.64 * s, 0.63 * s); ctx.stroke();

  // Orb near far (left) shoulder
  const pulse = 1 + 0.08 * Math.sin(t * 4);
  const ox = 0.14 * s, oy = 0.66 * s, or = s * 0.075 * pulse;
  g = ctx.createRadialGradient(ox, oy, or * 0.3, ox, oy, or * 2.6);
  g.addColorStop(0, 'rgba(40,230,210,0.55)'); g.addColorStop(1, 'rgba(40,230,210,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, or * 2.6, 0, 7); ctx.fill();
  g = ctx.createRadialGradient(ox - or * 0.3, oy - or * 0.3, 0, ox, oy, or);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#8ff7ee'); g.addColorStop(1, TEAL_D);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, or, 0, 7); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  ctx.strokeStyle = 'rgba(200,255,250,0.8)'; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(ox, oy, or * 1.5, t * 3, t * 3 + 1.6); ctx.stroke();

  // Kunai held up at right, in a gloved fist
  ctx.save();
  ctx.translate(0.86 * s, 0.7 * s); ctx.rotate(0.14);
  // blade
  const bl = ctx.createLinearGradient(-0.04 * s, 0, 0.04 * s, 0);
  bl.addColorStop(0, '#7e8db0'); bl.addColorStop(0.5, '#e8f0ff'); bl.addColorStop(1, '#a9b8d6');
  ctx.beginPath();
  ctx.moveTo(0, -0.5 * s); ctx.lineTo(0.05 * s, -0.27 * s); ctx.lineTo(0.025 * s, -0.12 * s);
  ctx.lineTo(-0.025 * s, -0.12 * s); ctx.lineTo(-0.05 * s, -0.27 * s); ctx.closePath();
  ctx.fillStyle = bl; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  ctx.strokeStyle = 'rgba(40,230,210,0.7)'; ctx.lineWidth = lw * 0.8;
  ctx.beginPath(); ctx.moveTo(0, -0.46 * s); ctx.lineTo(0, -0.16 * s); ctx.stroke();
  // grip
  ctx.fillStyle = '#1b2442'; ctx.fillRect(-0.02 * s, -0.12 * s, 0.04 * s, 0.14 * s);
  ctx.strokeStyle = OUT; ctx.strokeRect(-0.02 * s, -0.12 * s, 0.04 * s, 0.14 * s);
  // ring pommel
  ctx.strokeStyle = '#9fb0d0'; ctx.lineWidth = s * 0.014;
  ctx.beginPath(); ctx.arc(0, 0.065 * s, s * 0.032, 0, 7); ctx.stroke();
  // fist
  ctx.beginPath();
  ctx.ellipse(0, -0.04 * s, 0.065 * s, 0.05 * s, 0, 0, 7);
  ctx.fillStyle = '#10162e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  ctx.fillStyle = 'rgba(120,150,230,0.4)';
  ctx.fillRect(-0.05 * s, -0.065 * s, 0.1 * s, 0.012 * s);
  ctx.restore();

  ctx.restore();
});
