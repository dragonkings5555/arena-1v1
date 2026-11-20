// GUNNER portrait: grizzled mercenary, beanie, headset, orange visor, rifle at the shoulder.
(function () {
  Game.Avatars.register('gunner', function (ctx, s, opts) {
    const t = opts.t || 0;
    const col = opts.color || '#ffffff';
    const L = s * 0.012;
    const bob = Math.sin(t * 1.8) * s * 0.005;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3);
    const P = (pts, close) => { ctx.beginPath(); ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * s, pts[i][1] * s);
      if (close !== false) ctx.closePath(); };
    const fillStroke = (fill, stroke) => { ctx.fillStyle = fill; ctx.fill();
      if (stroke !== false) { ctx.lineWidth = L; ctx.strokeStyle = '#140d08'; ctx.lineJoin = 'round'; ctx.stroke(); } };
    ctx.save();

    // background
    let g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#3a2718'); g.addColorStop(1, '#150e0a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    g = ctx.createRadialGradient(s * 0.5, s * 0.4, 0, s * 0.5, s * 0.4, s * 0.62);
    g.addColorStop(0, 'rgba(255,170,70,0.42)'); g.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    // rim light from player colour
    g = ctx.createLinearGradient(0, 0, s * 0.3, 0);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.28; ctx.fillStyle = g; ctx.fillRect(0, 0, s * 0.3, s); ctx.globalAlpha = 1;

    ctx.translate(0, bob);

    // rifle barrel behind right shoulder
    ctx.save();
    ctx.translate(s * 0.86, s * 0.9); ctx.rotate(0.1);
    ctx.beginPath(); ctx.rect(-s * 0.05, -s * 0.5, s * 0.1, s * 0.62); fillStroke('#4a4f52');
    ctx.fillStyle = '#6f777b'; ctx.fillRect(-s * 0.05, -s * 0.5, s * 0.03, s * 0.62);
    ctx.fillStyle = '#2b2e30'; ctx.fillRect(-s * 0.07, -s * 0.56, s * 0.14, s * 0.07);
    ctx.fillStyle = '#ffb02e'; ctx.globalAlpha = pulse; ctx.fillRect(-s * 0.035, -s * 0.57, s * 0.07, s * 0.02); ctx.globalAlpha = 1;
    ctx.fillStyle = '#2b2e30'; ctx.fillRect(-s * 0.06, -s * 0.3, s * 0.12, s * 0.05);
    ctx.restore();

    // torso / vest
    P([[0.02, 1.02], [0.04, 0.8], [0.2, 0.72], [0.36, 0.68], [0.64, 0.68], [0.8, 0.72], [0.97, 0.8], [1.0, 1.02]]);
    fillStroke('#4e5a34');
    // shadow side
    P([[0.02, 1.02], [0.04, 0.8], [0.2, 0.72], [0.3, 0.7], [0.3, 1.02]]);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    // vest plate
    P([[0.26, 0.75], [0.4, 0.72], [0.62, 0.72], [0.74, 0.76], [0.8, 1.02], [0.2, 1.02]]);
    fillStroke('#2c3128');
    // plate highlight and pouch
    P([[0.4, 0.8], [0.6, 0.8], [0.6, 0.88], [0.4, 0.88]]); fillStroke('#3d4436');
    ctx.fillStyle = '#ffb02e'; ctx.fillRect(s * 0.44, s * 0.835, s * 0.12, s * 0.014);
    // shoulder straps
    P([[0.24, 0.73], [0.34, 0.7], [0.4, 1.02], [0.3, 1.02]]); fillStroke('#1f231c');
    P([[0.64, 0.7], [0.74, 0.73], [0.78, 1.02], [0.66, 1.02]]); fillStroke('#1f231c');
    // shoulder pad highlight
    P([[0.07, 0.8], [0.2, 0.74], [0.24, 0.78], [0.1, 0.85]]); fillStroke('#6b7a45');

    // neck
    P([[0.38, 0.52], [0.62, 0.52], [0.64, 0.72], [0.5, 0.78], [0.36, 0.72]]); fillStroke('#a9704a');
    P([[0.38, 0.6], [0.56, 0.66], [0.5, 0.78], [0.36, 0.72]]); ctx.fillStyle = 'rgba(60,25,10,0.35)'; ctx.fill();
    // collar
    P([[0.34, 0.7], [0.46, 0.76], [0.5, 0.82], [0.4, 0.74]]); fillStroke('#20241c');
    P([[0.66, 0.7], [0.56, 0.76], [0.52, 0.82], [0.6, 0.74]]); fillStroke('#20241c');

    // ear (far left side, headset sits over it)
    // head: 3/4 right, strong square jaw
    const head = [[0.3, 0.3], [0.33, 0.18], [0.44, 0.12], [0.58, 0.14], [0.68, 0.22], [0.7, 0.34], [0.72, 0.42],
      [0.69, 0.5], [0.64, 0.58], [0.55, 0.64], [0.46, 0.63], [0.37, 0.56], [0.31, 0.46]];
    P(head); fillStroke('#c68a5e');
    // face shadow (left/back side)
    P([[0.3, 0.3], [0.36, 0.2], [0.42, 0.3], [0.41, 0.5], [0.46, 0.63], [0.37, 0.56], [0.31, 0.46]]);
    ctx.fillStyle = 'rgba(80,35,15,0.35)'; ctx.fill();
    // stubble on jaw
    P([[0.36, 0.5], [0.46, 0.55], [0.56, 0.54], [0.66, 0.5], [0.64, 0.58], [0.55, 0.64], [0.46, 0.63], [0.37, 0.56]]);
    ctx.fillStyle = 'rgba(40,24,16,0.55)'; ctx.fill();
    // mouth and grim line
    ctx.strokeStyle = '#2a140c'; ctx.lineWidth = L * 1.4; ctx.lineCap = 'round';
    P([[0.5, 0.55], [0.58, 0.56], [0.64, 0.54]], false); ctx.stroke();
    // nose
    P([[0.62, 0.34], [0.69, 0.43], [0.63, 0.46], [0.58, 0.45]]); fillStroke('#b87a52');
    // cheek highlight
    ctx.fillStyle = 'rgba(255,210,160,0.25)'; P([[0.55, 0.36], [0.62, 0.4], [0.6, 0.47], [0.52, 0.44]]); ctx.fill();

    // brow, far eye
    ctx.strokeStyle = '#1e120a'; ctx.lineWidth = L * 2.2;
    P([[0.4, 0.31], [0.5, 0.3]], false); ctx.stroke();
    ctx.fillStyle = '#f2e6d0'; ctx.beginPath(); ctx.ellipse(s * 0.46, s * 0.355, s * 0.034, s * 0.018, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1c120a'; ctx.beginPath(); ctx.arc(s * 0.475, s * 0.355, s * 0.015, 0, 7); ctx.fill();
    // scar
    ctx.strokeStyle = '#e8b08c'; ctx.lineWidth = L * 1.2;
    P([[0.44, 0.25], [0.48, 0.4], [0.5, 0.47]], false); ctx.stroke();
    ctx.strokeStyle = '#6a2f22'; ctx.lineWidth = L * 0.5; ctx.stroke();

    // visor over near eye
    ctx.save();
    ctx.shadowColor = '#ff9b1e'; ctx.shadowBlur = s * 0.05 * pulse;
    P([[0.54, 0.31], [0.69, 0.31], [0.71, 0.4], [0.58, 0.4]]); fillStroke('#ffa31f');
    ctx.restore();
    P([[0.56, 0.325], [0.67, 0.325], [0.685, 0.37], [0.585, 0.37]]); ctx.fillStyle = '#ffe08a'; ctx.fill();
    ctx.fillStyle = '#fff6cf'; ctx.fillRect(s * 0.58, s * 0.335, s * 0.05, s * 0.012);
    // visor band across head
    P([[0.5, 0.31], [0.55, 0.31], [0.57, 0.4], [0.52, 0.38]]); fillStroke('#2b2e30');

    // beanie / cap
    P([[0.27, 0.32], [0.28, 0.17], [0.38, 0.07], [0.54, 0.05], [0.68, 0.11], [0.72, 0.22], [0.71, 0.28], [0.6, 0.25], [0.45, 0.24], [0.33, 0.3]]);
    fillStroke('#3a4226');
    P([[0.28, 0.17], [0.38, 0.07], [0.5, 0.06], [0.4, 0.14], [0.31, 0.24]]); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    // cuff
    P([[0.27, 0.32], [0.29, 0.22], [0.45, 0.2], [0.6, 0.21], [0.72, 0.24], [0.71, 0.3], [0.6, 0.27], [0.45, 0.26], [0.33, 0.31]]);
    fillStroke('#242a17');
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = L;
    for (let i = 0; i < 5; i++) { const x = 0.34 + i * 0.075; P([[x, 0.23], [x + 0.01, 0.285]], false); ctx.stroke(); }

    // headset earcup + mic boom
    ctx.beginPath(); ctx.ellipse(s * 0.34, s * 0.42, s * 0.05, s * 0.075, 0, 0, 7); fillStroke('#2b2e30');
    ctx.beginPath(); ctx.ellipse(s * 0.345, s * 0.42, s * 0.025, s * 0.045, 0, 0, 7); fillStroke('#51585b', false);
    ctx.strokeStyle = '#2b2e30'; ctx.lineWidth = L * 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.34, s * 0.5); ctx.quadraticCurveTo(s * 0.4, s * 0.62, s * 0.52, s * 0.6); ctx.stroke();
    ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(s * 0.52, s * 0.6, s * 0.014, 0, 7); ctx.fill();

    ctx.restore();
  });
})();
