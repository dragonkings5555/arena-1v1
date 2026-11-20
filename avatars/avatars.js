// Character portraits, drawn with canvas paths (no images). One file per character in avatars/.
// Usage: Game.Avatars.draw(ctx, 'ninja', x, y, size, { color: '#4fc3f7', t: seconds, mirror: false, frame: true })
window.Game = window.Game || {};

Game.Avatars = {
  painters: {},

  /*
   PAINTER CONTRACT
     Game.Avatars.register(id, function (ctx, s, opts) { ... })
       id    = character id from characters.js ('gunner' | 'ninja' | 'voidwalker')
       ctx   = canvas 2D context, already translated so the portrait square is (0,0)-(s,s)
               and clipped to the rounded frame. Draw in units relative to s (e.g. s*0.5).
       opts  = { color: player accent color (hex), t: time in seconds for subtle idle animation }
     The painter draws its own background and a head-and-shoulders bust facing ~3/4 right.
     Must save()/restore() any state it changes. No images, no external fonts.
  */
  register(id, fn) { this.painters[id] = fn; },

  has(id) { return !!this.painters[id]; },

  draw(ctx, id, x, y, size, opts) {
    opts = opts || {};
    const color = opts.color || '#ffffff';
    const r = size * 0.14;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, r);
    ctx.save();
    ctx.clip();
    if (opts.mirror) { ctx.translate(size, 0); ctx.scale(-1, 1); }
    const fn = this.painters[id];
    if (fn) {
      fn(ctx, size, { color, t: opts.t || 0 });
    } else {
      ctx.fillStyle = '#1a1d2a';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold ' + Math.round(size * 0.4) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', size / 2, size / 2);
    }
    ctx.restore();
    if (opts.frame !== false) {
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, r);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, size * 0.03);
      ctx.stroke();
    }
    ctx.restore();
  },
};
