// NINJA top-down sprite: navy hood, teal headband with team-colored tails, kunai in lead hand.
Game.Sprites.register('ninja', function (ctx, a) {
  const r = a.r, t = a.t, mv = a.move;
  const OUT = '#05070f', TEAL = '#28e6d2', TEAL_D = '#0a8f93';
  const lw = 1.5;
  const sw = Math.sin(a.walk) * mv;
  const idle = Math.sin(t * 2.4) * (1 - mv);
  const at = a.attack;
  const flash = a.flash;
  const NAVY = flash ? '#ffffff' : '#1d2747';
  const NAVY_D = flash ? '#f0f4ff' : '#10162e';
  const HOOD = flash ? '#ffffff' : '#2a386b';
  const SKIN = flash ? '#ffffff' : '#c8946a';
  const stroke = () => { ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); };
  const ell = (x, y, rx, ry, rot, fill) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill(); stroke();
  };

  ctx.save();
  // forward lean + stun droop
  let lean = mv * r * 0.05;
  if (a.stunned) { ctx.rotate(Math.sin(t * 8) * 0.12 + 0.18); lean = -r * 0.05; }
  ctx.translate(lean, 0);

  // --- headband tails (behind, -x), flutter more when moving ---
  const len = r * (0.6 + 0.45 * mv) * (a.stunned ? 0.6 : 1);
  const fl = 0.25 + 0.5 * mv;
  const tail = (y0, ph, fill, k) => {
    const w1 = Math.sin(t * 7 + ph) * r * 0.25 * fl + Math.sin(t * 2.2 + ph) * r * 0.08;
    const w2 = Math.sin(t * 7 + ph - 1.3) * r * 0.35 * fl;
    const x0 = -r * 0.45, w = r * 0.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - w * 0.5);
    ctx.bezierCurveTo(x0 - len * 0.4, y0 + w1 - w * 0.5, x0 - len * 0.7, y0 + w2 + k - w * 0.5, x0 - len, y0 + w2 + k * 1.4);
    ctx.lineTo(x0 - len * 0.85, y0 + w2 + k * 1.4 + w * 0.9);
    ctx.bezierCurveTo(x0 - len * 0.6, y0 + w2 + k + w * 0.5, x0 - len * 0.4, y0 + w1 + w * 0.5, x0, y0 + w * 0.5);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); stroke();
  };
  tail(-r * 0.1, 0, flash ? '#fff' : TEAL_D, -r * 0.3);
  tail(r * 0.1, 1.4, flash ? '#fff' : a.color, r * 0.3);

  // --- far (left, -y) arm: swings opposite ---
  const armL = -sw * r * 0.35 - idle * r * 0.04;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.45);
  ctx.lineTo(r * 0.3 + armL * 0.7, -r * 0.7);
  ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.lineWidth = r * 0.28 - lw * 1.6; ctx.strokeStyle = NAVY; ctx.stroke();
  ctx.restore();
  ell(r * 0.3 + armL * 0.7, -r * 0.7, r * 0.14, r * 0.12, 0, NAVY_D);

  // --- feet peeking out (swing) ---
  ell(-r * 0.2 + sw * r * 0.4, -r * 0.5, r * 0.2, r * 0.12, 0, NAVY_D);
  ell(-r * 0.2 - sw * r * 0.4, r * 0.5, r * 0.2, r * 0.12, 0, NAVY_D);

  // --- shoulders / torso (slim, wide along y) ---
  ctx.beginPath();
  ctx.ellipse(-r * 0.12, 0, r * 0.5, r * 0.78, 0, 0, Math.PI * 2);
  ctx.fillStyle = NAVY; ctx.fill(); stroke();
  // team sash across the chest
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, -r * 0.5); ctx.lineTo(-r * 0.25, -r * 0.66);
  ctx.lineTo(r * 0.25, r * 0.5); ctx.lineTo(r * 0.02, r * 0.66); ctx.closePath();
  ctx.fillStyle = flash ? '#fff' : a.color; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; stroke();

  // --- near (right, +y) arm with kunai ---
  // thrust: arm extends forward on attack
  const ext = at * r * 0.4;
  const hx = r * 0.4 + ext + sw * r * 0.1 + idle * r * 0.04;
  const hy = r * 0.55 - at * r * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-r * 0.05, r * 0.45);
  ctx.lineTo(hx, hy);
  ctx.lineWidth = r * 0.3; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.lineWidth = r * 0.3 - lw * 1.6; ctx.strokeStyle = NAVY; ctx.stroke();
  ctx.restore();

  // kunai (points +x), held in fist
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-0.1 - at * 0.1);
  // ring pommel
  ctx.beginPath(); ctx.arc(-r * 0.22, 0, r * 0.1, 0, Math.PI * 2);
  ctx.strokeStyle = OUT; ctx.lineWidth = lw + 2; ctx.stroke();
  ctx.strokeStyle = '#aab8d4'; ctx.lineWidth = 1.6; ctx.stroke();
  // grip
  ctx.fillStyle = '#2b3866'; ctx.fillRect(-r * 0.15, -r * 0.06, r * 0.3, r * 0.12);
  ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.strokeRect(-r * 0.15, -r * 0.06, r * 0.3, r * 0.12);
  // blade
  ctx.beginPath();
  ctx.moveTo(r * 0.1, -r * 0.15); ctx.lineTo(r * 0.35, -r * 0.12);
  ctx.lineTo(r * 0.7, 0); ctx.lineTo(r * 0.35, r * 0.12); ctx.lineTo(r * 0.1, r * 0.15);
  ctx.closePath();
  ctx.fillStyle = '#e8f0ff'; ctx.fill(); stroke();
  ctx.strokeStyle = flash ? '#fff' : TEAL; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(r * 0.18, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
  ctx.restore();
  // fist over grip
  ell(hx, hy, r * 0.16, r * 0.15, 0, NAVY_D);

  // --- hood / head ---
  const hxc = r * 0.05;
  const hr = r * 0.6;
  ctx.beginPath();
  ctx.ellipse(hxc, 0, hr * 1.05, hr, 0, 0, Math.PI * 2);
  ctx.fillStyle = HOOD; ctx.fill(); stroke();
  // hood fold shading (back)
  ctx.beginPath();
  ctx.ellipse(hxc - hr * 0.35, 0, hr * 0.55, hr * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,12,0.22)'; ctx.fill();
  // hood seam
  ctx.strokeStyle = 'rgba(0,0,12,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hxc - hr * 0.9, 0); ctx.lineTo(hxc + hr * 0.1, 0); ctx.stroke();

  // eye slit (front opening)
  ctx.beginPath();
  ctx.moveTo(hxc + hr * 0.5, -hr * 0.62);
  ctx.quadraticCurveTo(hxc + hr * 1.0, 0, hxc + hr * 0.5, hr * 0.62);
  ctx.lineTo(hxc + hr * 0.3, hr * 0.5);
  ctx.quadraticCurveTo(hxc + hr * 0.65, 0, hxc + hr * 0.3, -hr * 0.5);
  ctx.closePath();
  ctx.fillStyle = SKIN; ctx.fill(); stroke();
  // eyes
  ctx.fillStyle = flash ? '#fff' : TEAL;
  ctx.fillRect(hxc + hr * 0.5, -hr * 0.4, hr * 0.14, hr * 0.22);
  ctx.fillRect(hxc + hr * 0.5, hr * 0.18, hr * 0.14, hr * 0.22);

  // headband across the head (ear to ear along y) with team-color knot behind
  ctx.beginPath();
  ctx.moveTo(hxc - hr * 0.05, -hr * 0.98);
  ctx.lineTo(hxc + hr * 0.3, -hr * 0.82);
  ctx.lineTo(hxc + hr * 0.3, hr * 0.82);
  ctx.lineTo(hxc - hr * 0.05, hr * 0.98);
  ctx.closePath();
  ctx.fillStyle = flash ? '#fff' : TEAL_D; ctx.fill(); stroke();
  // metal plate
  ctx.beginPath();
  ctx.rect(hxc - hr * 0.02, -hr * 0.3, hr * 0.28, hr * 0.6);
  ctx.fillStyle = '#c4d0ea'; ctx.fill(); stroke();
  ctx.fillStyle = flash ? '#fff' : TEAL;
  ctx.beginPath(); ctx.arc(hxc + hr * 0.12, 0, hr * 0.09, 0, Math.PI * 2); ctx.fill();
  // knot at back of head
  ell(hxc - hr * 0.9, 0, hr * 0.2, hr * 0.24, 0, flash ? '#fff' : a.color);

  ctx.restore();
});
