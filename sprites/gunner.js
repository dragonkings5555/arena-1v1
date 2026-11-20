// GUNNER top-down sprite: olive beanie, tactical vest, gunmetal rifle held in both hands.
(function () {
  Game.Sprites.register('gunner', function (ctx, a) {
    const r = a.r, TAU = Math.PI * 2;
    const OL = '#10120d';
    const sw = Math.sin(a.walk) * a.move;
    const breathe = Math.sin(a.t * 2.2) * 0.035;
    const rec = a.attack * 4;                // recoil px
    const sway = sw * 1.6;                   // shoulder sway (y)
    const k = 1 + breathe;

    const fillOut = (fill, lw) => {
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = lw || 1.5; ctx.strokeStyle = OL; ctx.lineJoin = 'round'; ctx.stroke();
    };
    const rrect = (x, y, w, h, rad) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad); else ctx.rect(x, y, w, h);
    };
    const bodyPath = () => { // torso silhouette (shoulders wide on y)
      ctx.beginPath();
      ctx.ellipse(-1, sway * 0.4, r * 0.62 * k, r * 0.92, 0, 0, TAU);
    };

    ctx.save();
    if (!a.alive) ctx.globalAlpha *= 0.6;

    // boots peeking out front/back, alternating with walk
    for (let s = -1; s <= 1; s += 2) {
      const bx = -r * 0.1 + sw * s * r * 0.55;
      ctx.beginPath(); rrect(bx - r * 0.3, s * r * 0.52 - r * 0.2, r * 0.8, r * 0.4, r * 0.15);
      fillOut('#2a2420');
      ctx.fillStyle = '#3d342d'; ctx.fillRect(bx + r * 0.2, s * r * 0.52 - r * 0.12, r * 0.22, r * 0.24);
    }

    // rifle (recoils back along -x)
    ctx.save();
    ctx.translate(-rec, 0);
    ctx.scale(0.7, 1);   // keep rifle tip <= ~1.6r
    // stock
    ctx.beginPath(); rrect(r * 0.0, -r * 0.2, r * 0.7, r * 0.4, 2); fillOut('#3b3f42');
    // body/receiver
    ctx.beginPath(); rrect(r * 0.55, -r * 0.24, r * 0.9, r * 0.48, 2); fillOut('#4d5357');
    ctx.fillStyle = '#7d868b'; ctx.fillRect(r * 0.6, -r * 0.2, r * 0.8, r * 0.1);
    // magazine
    ctx.beginPath(); rrect(r * 0.85, r * 0.2, r * 0.3, r * 0.4, 2); fillOut('#2b2e30');
    // barrel
    ctx.beginPath(); rrect(r * 1.4, -r * 0.1, r * 0.8, r * 0.2, 1.5); fillOut('#2e3235');
    // muzzle brake with orange accent
    ctx.beginPath(); rrect(r * 2.05, -r * 0.17, r * 0.2, r * 0.34, 1.5); fillOut('#1f2224');
    ctx.fillStyle = '#ffa31f'; ctx.fillRect(r * 2.14, -r * 0.1, r * 0.07, r * 0.2);
    // optic w/ orange visor accent
    ctx.beginPath(); rrect(r * 0.8, -r * 0.42, r * 0.4, r * 0.18, 2); fillOut('#25282a');
    ctx.fillStyle = '#ffa31f'; ctx.fillRect(r * 1.12, -r * 0.4, r * 0.06, r * 0.14);
    ctx.restore();

    // arms: from shoulders to the rifle (left arm reaches the handguard, right the grip)
    const armL = [r * 0.84 - rec, -r * 0.12], armR = [r * 0.4 - rec, r * 0.18];
    ctx.lineCap = 'round';
    const arm = (sx, sy, hx, hy) => {
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy);
      ctx.lineWidth = r * 0.5; ctx.strokeStyle = OL; ctx.stroke();
      ctx.lineWidth = r * 0.5 - 3; ctx.strokeStyle = '#4e5a34'; ctx.stroke();
    };
    arm(0, -r * 0.7 + sway, armL[0] - r * 0.05, armL[1] - r * 0.05);
    arm(0, r * 0.7 + sway, armR[0], armR[1]);
    // hands
    for (const h of [armL, armR]) {
      ctx.beginPath(); ctx.arc(h[0], h[1], r * 0.23, 0, TAU); fillOut('#c68a5e');
    }

    // torso / vest
    bodyPath(); fillOut('#4e5a34');
    // vest plate
    ctx.beginPath(); rrect(-r * 0.45, -r * 0.5 + sway * 0.4, r * 0.8, r * 1.0, 3); fillOut('#2c3128');
    ctx.fillStyle = '#3d4436'; ctx.fillRect(-r * 0.2, -r * 0.34 + sway * 0.4, r * 0.35, r * 0.2);
    ctx.fillStyle = '#ffa31f'; ctx.fillRect(r * 0.05, r * 0.0 + sway * 0.4, r * 0.18, 2);
    // shoulder patches in team colour
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath(); rrect(-r * 0.25, s * r * 0.68 - r * 0.15 + sway, r * 0.5, r * 0.3, 3);
      fillOut(a.color, 1.2);
    }
    // team stripe across the back of the vest
    ctx.fillStyle = a.color; ctx.fillRect(-r * 0.6, -r * 0.4 + sway * 0.4, r * 0.14, r * 0.8);

    // head: skin hint (face is forward, beneath beanie), tilt when stunned
    ctx.save();
    ctx.translate(r * 0.08, sway * 0.3);
    if (a.stunned) ctx.rotate(Math.sin(a.t * 14) * 0.25);
    ctx.beginPath(); ctx.ellipse(r * 0.05, 0, r * 0.62, r * 0.6, 0, 0, TAU); fillOut('#c68a5e');
    // beanie
    ctx.beginPath(); ctx.ellipse(-r * 0.05, 0, r * 0.58 * k, r * 0.56 * k, 0, 0, TAU); fillOut('#3f4a28');
    // cuff band toward the face
    ctx.beginPath(); ctx.ellipse(-r * 0.05, 0, r * 0.58 * k, r * 0.56 * k, 0, -1.15, 1.15);
    ctx.lineWidth = r * 0.22; ctx.strokeStyle = '#242a17'; ctx.lineCap = 'butt'; ctx.stroke();
    // knit ribs + highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.5, i * r * 0.17); ctx.lineTo(r * 0.2, i * r * 0.17); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.18, r * 0.12, 0, TAU); ctx.fillStyle = '#6b7a45'; ctx.fill();
    // orange visor sliver at the front
    ctx.beginPath(); rrect(r * 0.46, -r * 0.24, r * 0.16, r * 0.34, 2); fillOut('#ffa31f', 1.2);
    ctx.restore();

    // hit flash: white silhouette overlay
    if (a.flash) {
      ctx.save();
      ctx.globalAlpha = 0.8; ctx.fillStyle = '#fff';
      bodyPath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.03, sway * 0.3, r * 0.6, r * 0.58, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // muzzle flash
    if (a.attack > 0.35) {
      const f = a.attack, mx = r * 1.6 - rec;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ff8a1e';
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx + r * 0.4 * f, -r * 0.3 * f);
      ctx.lineTo(mx + r * 0.8 * f, 0); ctx.lineTo(mx + r * 0.4 * f, r * 0.3 * f); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx + r * 0.3 * f, -r * 0.14 * f);
      ctx.lineTo(mx + r * 0.65 * f, 0); ctx.lineTo(mx + r * 0.3 * f, r * 0.14 * f); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  });
})();
