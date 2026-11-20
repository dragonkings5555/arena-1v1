// In-arena character sprites (top-down), drawn with canvas paths. One painter file per character in sprites/.
// player.js calls Game.Sprites.drawPlayer(ctx, player) when a painter exists for player.character.id.
window.Game = window.Game || {};

Game.Sprites = {
  painters: {},
  _anim: new Map(),   // player -> { px, py, walk, move, atk, prevCd, t }

  /*
   PAINTER CONTRACT
     Game.Sprites.register(id, function (ctx, a) { ... })
       ctx: translated to the player's center and ROTATED so +x is the facing/aim direction
            (the character looks and shoots along +x; +y is its right side). Top-down view.
            Body radius is a.r (16px) = the hit circle: keep the body within r; weapons/slashes up to ~1.6*r along +x, trailing cloth ~1.5*r behind.
       a = {
         r:      body radius (px)
         color:  player color (hex) - use it as a clear team accent (e.g. scarf, trim, glow) so P1/P2 differ
         t:      seconds (for idle shimmer etc.)
         move:   0..1 how much the player is walking right now (smoothed)
         walk:   walk-cycle phase in radians (advances with distance moved): use sin(walk) for feet/shoulder swing
         attack: 0..1, 1 right after firing, decays to 0 over ~0.2s: use for recoil/throw/kick
         stunned: bool, alive: bool, flash: bool (true while hit-flashing: tint the body white)
       }
     Must save()/restore() any state it changes. No images, no text.
  */
  register(id, fn) { this.painters[id] = fn; },
  has(id) { return !!this.painters[id]; },

  _state(p, dt) {
    let s = this._anim.get(p);
    if (!s) { s = { px: p.x, py: p.y, walk: 0, move: 0, atk: 0, prevCd: p.cooldown || 0 }; this._anim.set(p, s); }
    const d = Math.hypot(p.x - s.px, p.y - s.py);
    const moving = d > 0.3 && d < 60;          // ignore teleports/respawns
    if (moving) s.walk += d * 0.18;
    s.move += ((moving ? 1 : 0) - s.move) * Math.min(1, dt * 12);
    if ((p.cooldown || 0) > s.prevCd + 0.01) s.atk = 1;   // just fired
    s.prevCd = p.cooldown || 0;
    s.atk = Math.max(0, s.atk - dt * 5);
    s.px = p.x; s.py = p.y;
    return s;
  },

  drawPlayer(ctx, p) {
    const now = performance.now() / 1000;
    const s0 = this._anim.get(p);
    const dt = s0 && s0.last ? Math.min(0.05, now - s0.last) : 1 / 60;
    const s = this._state(p, dt);
    s.last = now;
    const r = p.radius;

    // Team ring on the floor so P1/P2 are always readable.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 3, r * 1.15, r * 1.0, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.color;
    ctx.globalAlpha *= 0.7;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.facing.y, p.facing.x));
    this.painters[p.character.id](ctx, {
      r, color: p.color, t: now, move: s.move, walk: s.walk, attack: s.atk,
      stunned: p.stunTime > 0, alive: p.alive, flash: p.alive && p.hitFlash > 0,
    });
    ctx.restore();
  },
};
