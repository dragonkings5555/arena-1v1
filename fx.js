// fx.js - shared "game feel" helpers any ability can call: screen shake, hit-stop, screen flash.
window.Game = window.Game || {};

Game.FX = {
  _shake: 0,        // current shake strength in px
  _shakeTime: 0,
  _shakeDur: 0,
  _stop: 0,         // remaining hit-stop (freeze) time
  _flash: null,     // {color, alpha, time, dur}

  // Shake the camera by up to `px` pixels for `seconds` (strongest call wins).
  shake(px, seconds = 0.2) {
    if (px >= this._shake * (this._shakeTime / (this._shakeDur || 1))) {
      this._shake = px; this._shakeTime = seconds; this._shakeDur = seconds;
    }
  },
  // Freeze gameplay for a few frames to sell a big hit (keep it short: 0.04-0.12s).
  hitStop(seconds = 0.06) { this._stop = Math.max(this._stop, Math.min(seconds, 0.15)); },
  // Tint the whole screen briefly.
  flash(color = '#ffffff', alpha = 0.25, seconds = 0.12) { this._flash = { color, alpha, time: seconds, dur: seconds }; },

  reset() { this._shake = this._shakeTime = this._stop = 0; this._flash = null; },

  // main.js: returns true while gameplay should stay frozen.
  tick(dt) {
    if (this._shakeTime > 0) this._shakeTime = Math.max(0, this._shakeTime - dt);
    if (this._flash) { this._flash.time -= dt; if (this._flash.time <= 0) this._flash = null; }
    if (this._stop > 0) { this._stop = Math.max(0, this._stop - dt); return true; }
    return false;
  },
  // main.js: apply camera shake before drawing the world.
  applyShake(ctx) {
    if (this._shakeTime <= 0) return;
    const k = this._shake * (this._shakeTime / this._shakeDur);
    ctx.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);
  },
  // main.js: draw the flash over the world (under the HUD).
  drawFlash(ctx) {
    const f = this._flash;
    if (!f) return;
    ctx.save();
    ctx.globalAlpha = f.alpha * (f.time / f.dur);
    ctx.fillStyle = f.color;
    ctx.fillRect(0, 0, Game.CONFIG.WIDTH, Game.CONFIG.HEIGHT);
    ctx.restore();
  },
};
