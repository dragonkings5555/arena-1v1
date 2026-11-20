// Voidwalker portrait: hooded void figure with glowing violet eyes, shard crown, drifting smoke.
(function () {
  Game.Avatars.register('voidwalker', function (ctx, s, opts) {
    var t = opts.t || 0;
    var col = opts.color || '#b388ff';
    var P = function (x, y) { return [x * s, y * s]; };
    function poly(pts, curve) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * s, pts[i][1] * s);
      ctx.closePath();
    }
    var line = Math.max(1, s * 0.012);

    ctx.save();

    // ---- background ----
    var bg = ctx.createRadialGradient(s * 0.55, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.85);
    bg.addColorStop(0, '#3a1466');
    bg.addColorStop(0.5, '#170a30');
    bg.addColorStop(1, '#07030f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);

    // vortex rings
    ctx.lineCap = 'round';
    for (var i = 0; i < 5; i++) {
      var r = s * (0.22 + i * 0.1);
      var a0 = t * 0.15 * (i % 2 ? -1 : 1) + i * 1.3;
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.38, r, a0, a0 + 1.6);
      ctx.strokeStyle = 'rgba(179,136,255,' + (0.16 - i * 0.02) + ')';
      ctx.lineWidth = s * 0.012;
      ctx.stroke();
    }
    // stars
    var seeds = [[.08,.12],[.18,.3],[.9,.1],[.82,.26],[.95,.5],[.06,.55],[.7,.06],[.3,.06],[.88,.7],[.12,.8],[.62,.2],[.04,.35]];
    for (i = 0; i < seeds.length; i++) {
      var tw = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 2.1);
      ctx.fillStyle = 'rgba(224,200,255,' + (0.35 + 0.4 * tw) + ')';
      var sr = s * (i % 3 === 0 ? 0.011 : 0.007);
      ctx.beginPath();
      ctx.arc(seeds[i][0] * s, seeds[i][1] * s, sr, 0, 6.3);
      ctx.fill();
    }
    // rim color glow from player color, bottom-left
    var rg = ctx.createRadialGradient(0, s, 0, 0, s, s * 0.7);
    rg.addColorStop(0, col + '55');
    rg.addColorStop(1, col + '00');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, s, s);

    // ---- smoke wisps off shoulders ----
    function wisp(x, y, dir, ph, w) {
      ctx.beginPath();
      var sway = Math.sin(t * 1.1 + ph) * s * 0.02;
      ctx.moveTo(x * s, y * s);
      ctx.bezierCurveTo((x + dir * 0.08) * s + sway, (y - 0.1) * s,
                        (x - dir * 0.04) * s + sway, (y - 0.2) * s,
                        (x + dir * 0.07) * s + sway * 1.5, (y - 0.32) * s);
      ctx.bezierCurveTo((x + dir * 0.0) * s + sway, (y - 0.2) * s,
                        (x + dir * 0.14) * s, (y - 0.1) * s,
                        (x + dir * w) * s, (y + 0.02) * s);
      ctx.closePath();
      var g = ctx.createLinearGradient(0, (y - 0.32) * s, 0, y * s);
      g.addColorStop(0, 'rgba(160,80,255,0)');
      g.addColorStop(1, 'rgba(120,50,220,0.55)');
      ctx.fillStyle = g;
      ctx.fill();
    }
    wisp(0.16, 0.8, -1, 0, 0.1);
    wisp(0.08, 0.86, -1, 2, 0.12);
    wisp(0.9, 0.82, 1, 4, -0.1);
    wisp(0.97, 0.88, 1, 1, -0.12);

    // ---- shoulders / body ----
    ctx.lineJoin = 'round';
    // back cloak
    poly([[0.0,1.0],[0.02,0.82],[0.14,0.72],[0.3,0.66],[0.62,0.66],[0.84,0.72],[0.98,0.82],[1.0,1.0]]);
    ctx.fillStyle = '#120826';
    ctx.fill();
    // near (right) pauldron
    ctx.beginPath();
    ctx.moveTo(0.58 * s, 0.7 * s);
    ctx.bezierCurveTo(0.74 * s, 0.64 * s, 0.94 * s, 0.7 * s, 1.0 * s, 0.86 * s);
    ctx.lineTo(1.0 * s, s);
    ctx.lineTo(0.5 * s, s);
    ctx.closePath();
    var pg = ctx.createLinearGradient(0.6 * s, 0.65 * s, 0.95 * s, 0.95 * s);
    pg.addColorStop(0, '#3b1a6e');
    pg.addColorStop(1, '#1a0b38');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = '#08030f';
    ctx.lineWidth = line;
    ctx.stroke();
    // pauldron plate highlight edge
    ctx.beginPath();
    ctx.moveTo(0.6 * s, 0.715 * s);
    ctx.bezierCurveTo(0.74 * s, 0.67 * s, 0.9 * s, 0.72 * s, 0.97 * s, 0.84 * s);
    ctx.strokeStyle = '#b388ff';
    ctx.lineWidth = s * 0.012;
    ctx.stroke();
    // pauldron rift crack
    ctx.beginPath();
    ctx.moveTo(0.78 * s, 0.76 * s);
    ctx.lineTo(0.83 * s, 0.82 * s);
    ctx.lineTo(0.79 * s, 0.87 * s);
    ctx.lineTo(0.86 * s, 0.95 * s);
    ctx.strokeStyle = '#e040fb';
    ctx.lineWidth = s * 0.014;
    ctx.stroke();

    // left (far) shoulder
    ctx.beginPath();
    ctx.moveTo(0.04 * s, s);
    ctx.bezierCurveTo(0.02 * s, 0.84 * s, 0.14 * s, 0.72 * s, 0.34 * s, 0.7 * s);
    ctx.lineTo(0.5 * s, 0.76 * s);
    ctx.lineTo(0.46 * s, s);
    ctx.closePath();
    ctx.fillStyle = '#1d0d3d';
    ctx.fill();
    ctx.strokeStyle = '#08030f';
    ctx.lineWidth = line;
    ctx.stroke();

    // collar (dark armored), front of neck
    ctx.beginPath();
    ctx.moveTo(0.3 * s, 0.66 * s);
    ctx.lineTo(0.66 * s, 0.64 * s);
    ctx.lineTo(0.7 * s, 0.76 * s);
    ctx.lineTo(0.52 * s, 0.84 * s);
    ctx.lineTo(0.3 * s, 0.76 * s);
    ctx.closePath();
    ctx.fillStyle = '#0b0518';
    ctx.fill();
    ctx.strokeStyle = '#2a1252';
    ctx.lineWidth = line;
    ctx.stroke();
    // collar glow gem
    var gp = 0.7 + 0.3 * Math.sin(t * 2.2);
    ctx.fillStyle = 'rgba(224,64,251,' + gp + ')';
    ctx.beginPath();
    ctx.moveTo(0.5 * s, 0.745 * s);
    ctx.lineTo(0.535 * s, 0.775 * s);
    ctx.lineTo(0.5 * s, 0.815 * s);
    ctx.lineTo(0.465 * s, 0.775 * s);
    ctx.closePath();
    ctx.fill();

    // ---- hood ----
    ctx.beginPath();
    ctx.moveTo(0.44 * s, 0.06 * s);                                   // peak
    ctx.bezierCurveTo(0.6 * s, 0.1 * s, 0.76 * s, 0.24 * s, 0.76 * s, 0.44 * s); // front brow
    ctx.bezierCurveTo(0.76 * s, 0.56 * s, 0.72 * s, 0.64 * s, 0.66 * s, 0.7 * s);
    ctx.lineTo(0.3 * s, 0.72 * s);
    ctx.bezierCurveTo(0.2 * s, 0.6 * s, 0.18 * s, 0.4 * s, 0.26 * s, 0.26 * s);
    ctx.bezierCurveTo(0.31 * s, 0.16 * s, 0.38 * s, 0.1 * s, 0.44 * s, 0.06 * s);
    ctx.closePath();
    var hg = ctx.createLinearGradient(0.2 * s, 0.1 * s, 0.76 * s, 0.7 * s);
    hg.addColorStop(0, '#2a1256');
    hg.addColorStop(0.55, '#1a0a38');
    hg.addColorStop(1, '#0e0620');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = '#08030f';
    ctx.lineWidth = line * 1.2;
    ctx.stroke();

    // cel shade: dark back-side band of hood
    ctx.beginPath();
    ctx.moveTo(0.3 * s, 0.72 * s);
    ctx.bezierCurveTo(0.2 * s, 0.6 * s, 0.18 * s, 0.4 * s, 0.26 * s, 0.26 * s);
    ctx.bezierCurveTo(0.24 * s, 0.4 * s, 0.3 * s, 0.56 * s, 0.4 * s, 0.7 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(5,2,12,0.55)';
    ctx.fill();

    // top rim light on hood (front edge)
    ctx.beginPath();
    ctx.moveTo(0.45 * s, 0.075 * s);
    ctx.bezierCurveTo(0.6 * s, 0.11 * s, 0.745 * s, 0.25 * s, 0.745 * s, 0.43 * s);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = s * 0.014;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // face opening: void
    ctx.beginPath();
    ctx.moveTo(0.4 * s, 0.26 * s);
    ctx.bezierCurveTo(0.54 * s, 0.22 * s, 0.68 * s, 0.3 * s, 0.68 * s, 0.44 * s);
    ctx.bezierCurveTo(0.68 * s, 0.56 * s, 0.6 * s, 0.64 * s, 0.5 * s, 0.66 * s);
    ctx.bezierCurveTo(0.4 * s, 0.62 * s, 0.34 * s, 0.5 * s, 0.34 * s, 0.4 * s);
    ctx.bezierCurveTo(0.34 * s, 0.32 * s, 0.36 * s, 0.28 * s, 0.4 * s, 0.26 * s);
    ctx.closePath();
    var fg = ctx.createRadialGradient(0.56 * s, 0.46 * s, 0, 0.52 * s, 0.46 * s, s * 0.22);
    fg.addColorStop(0, '#12062a');
    fg.addColorStop(1, '#020006');
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.strokeStyle = '#3d1a78';
    ctx.lineWidth = line;
    ctx.stroke();

    // eyes: slanted, glowing, pulsing
    var pulse = 0.8 + 0.2 * Math.sin(t * 2.5);
    function eye(cx, cy, w, h, tilt) {
      ctx.save();
      ctx.translate(cx * s, cy * s);
      ctx.rotate(tilt);
      // glow
      var eg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * s * 1.6);
      eg.addColorStop(0, 'rgba(224,64,251,' + (0.55 * pulse) + ')');
      eg.addColorStop(1, 'rgba(224,64,251,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(-w * s * 2, -w * s * 2, w * s * 4, w * s * 4);
      // almond
      ctx.beginPath();
      ctx.moveTo(-w * s, 0);
      ctx.quadraticCurveTo(0, -h * s * 1.3, w * s, -h * s * 0.2);
      ctx.quadraticCurveTo(0, h * s * 0.9, -w * s, 0);
      ctx.closePath();
      ctx.fillStyle = '#e9d7ff';
      ctx.fill();
      ctx.lineWidth = s * 0.012;
      ctx.strokeStyle = '#b388ff';
      ctx.stroke();
      ctx.restore();
    }
    eye(0.45, 0.43, 0.065, 0.035, 0.22);   // far eye (smaller)
    eye(0.61, 0.44, 0.075, 0.04, 0.2);    // near eye

    // brow shadow over eyes
    ctx.beginPath();
    ctx.moveTo(0.37 * s, 0.34 * s);
    ctx.lineTo(0.66 * s, 0.36 * s);
    ctx.lineTo(0.66 * s, 0.385 * s);
    ctx.lineTo(0.37 * s, 0.37 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(2,0,6,0.6)';
    ctx.fill();

    // rifts of light on hood
    function rift(pts, w) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0] * s, pts[k][1] * s);
      ctx.strokeStyle = 'rgba(224,64,251,0.4)';
      ctx.lineWidth = w * 2.6;
      ctx.stroke();
      ctx.strokeStyle = '#e8d0ff';
      ctx.lineWidth = w;
      ctx.stroke();
    }
    rift([[0.3,0.3],[0.34,0.36],[0.31,0.42],[0.35,0.5]], s * 0.008);
    rift([[0.52,0.14],[0.56,0.19],[0.53,0.23]], s * 0.007);
    rift([[0.7,0.5],[0.67,0.56],[0.7,0.6]], s * 0.007);

    // ---- shard crown (floating) ----
    function shard(x, y, h, w, rot, ph) {
      var bob = Math.sin(t * 1.4 + ph) * s * 0.008;
      ctx.save();
      ctx.translate(x * s, y * s + bob);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -h * s);
      ctx.lineTo(w * s, 0);
      ctx.lineTo(0, h * s * 0.7);
      ctx.lineTo(-w * s, 0);
      ctx.closePath();
      ctx.shadowColor = '#e040fb';
      ctx.shadowBlur = s * 0.04;
      var sg = ctx.createLinearGradient(-w * s, 0, w * s, 0);
      sg.addColorStop(0, '#7c4dff');
      sg.addColorStop(1, '#e040fb');
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.shadowBlur = 0;
      // light facet
      ctx.beginPath();
      ctx.moveTo(0, -h * s);
      ctx.lineTo(w * s, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.restore();
    }
    shard(0.44, 0.045, 0.06, 0.03, 0, 0);
    shard(0.32, 0.1, 0.045, 0.022, -0.4, 1.5);
    shard(0.57, 0.08, 0.045, 0.022, 0.4, 3);
    shard(0.22, 0.2, 0.03, 0.016, -0.6, 4.5);
    shard(0.68, 0.17, 0.03, 0.016, 0.6, 2.2);

    ctx.restore();
  });
})();
