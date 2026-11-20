// void.js - Voidwalker ability2: vanish into the void for 3s (untargetable, nearly invisible, can still move).
window.Game = window.Game || {};
Game.Abilities = Game.Abilities || {};

Game.Abilities.VoidPhase = class VoidPhase {
  constructor(owner) {
    this.owner = owner;
    this.DURATION = 3.0;
    this.COOLDOWN = 7.0;
    this.ALPHA = 0;      // fully invisible to the opponent
    this.SPEED_BOOST = 1.15;
    this.IMPLODE_TIME = 0.3;
    this.TEAR_TIME = 0.35;
    this.MOTE_LIFE = 0.9;
    this.MOTE_EVERY = 0.07;   // sparse trail spawn interval (seconds)
    this.reset();
  }

  reset() {
    this.inVoid = false;
    this.timeLeft = 0;
    this.cooldown = 0;
    this.implodes = []; // {x, y, t, parts:[{a, d, s}]}
    this.tears = [];    // {x, y, t, parts:[{x, y, vx, vy}]}
    this.motes = [];    // {x, y, life, r}
    this.moteTimer = 0;
    this.smoke = [];    // {x, y, vx, vy, life, r}
    this.ripples = [];  // {x, y, t}
    this.rippleTimer = 0;
    this.cracks = [];   // {x, y, t, lines:[[x,y,...]]}
    this.waves = [];    // {x, y, t}
    this.lastX = this.owner.x;
    this.lastY = this.owner.y;
  }

  _enter() {
    const o = this.owner;
    this.inVoid = true;
    this.timeLeft = this.DURATION;
    this.moteTimer = 0;
    this.lastX = o.x; this.lastY = o.y;
    const parts = [];
    for (let i = 0; i < 20; i++) {
      parts.push({ a: Math.random() * Math.PI * 2, d: 45 + Math.random() * 40, s: 1.5 + Math.random() * 2 });
    }
    this.implodes.push({ x: o.x, y: o.y, t: 0, parts });
    this.rippleTimer = 0;
    Game.FX.flash('#1a0830', 0.25, 0.15);
    Game.FX.shake(3, 0.12);
  }

  _exit() {
    if (!this.inVoid) return;
    const o = this.owner;
    this.inVoid = false;
    this.cooldown = this.COOLDOWN;
    const parts = [];
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 240;
      parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
    }
    this.tears.push({ x: o.x, y: o.y, t: 0, parts });
    // Jagged rift cracks radiating outward.
    const lines = [];
    const n = 7, base = Math.random() * 6.28;
    for (let i = 0; i < n; i++) {
      let a = base + (i / n) * 6.28 + (Math.random() - 0.5) * 0.5, d = 6, x = o.x, y = o.y;
      const pts = [x, y];
      const segs = 4 + ((Math.random() * 3) | 0);
      for (let j = 0; j < segs; j++) {
        d = 10 + Math.random() * 14; a += (Math.random() - 0.5) * 0.9;
        x += Math.cos(a) * d; y += Math.sin(a) * d; pts.push(x, y);
      }
      lines.push(pts);
    }
    this.cracks.push({ x: o.x, y: o.y, t: 0, lines });
    this.waves.push({ x: o.x, y: o.y, t: 0 });
    if (this.cracks.length > 4) this.cracks.shift();
    if (this.waves.length > 4) this.waves.shift();
    Game.FX.flash('#b388ff', 0.15, 0.1);
    Game.FX.shake(3, 0.12);
  }

  update(dt, env) {
    const o = this.owner;
    this.cooldown = Math.max(0, this.cooldown - dt);

    // Age effects.
    for (const e of this.implodes) e.t += dt;
    this.implodes = this.implodes.filter((e) => e.t < this.IMPLODE_TIME);
    for (const e of this.tears) {
      e.t += dt;
      for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; }
    }
    this.tears = this.tears.filter((e) => e.t < this.TEAR_TIME);
    for (const m of this.motes) m.life -= dt;
    this.motes = this.motes.filter((m) => m.life > 0);
    for (const m of this.smoke) { m.x += m.vx * dt; m.y += m.vy * dt; m.vx *= 0.97; m.vy *= 0.97; m.life -= dt; }
    this.smoke = this.smoke.filter((m) => m.life > 0);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 0.9);
    for (const c of this.cracks) c.t += dt;
    this.cracks = this.cracks.filter((c) => c.t < 0.45);
    for (const w of this.waves) w.t += dt;
    this.waves = this.waves.filter((w) => w.t < 0.4);

    // Start.
    if (!this.inVoid && env.pressed && env.active && o.alive && this.cooldown <= 0) this._enter();
    else if (this.inVoid && env.pressed) { this._exit(); return; } // press again: leave early

    if (!this.inVoid) return;

    // Forced exits.
    this.timeLeft -= dt;
    if (this.timeLeft <= 0 || !env.active || !o.alive) {
      this.timeLeft = Math.max(0, this.timeLeft);
      this._exit();
      return;
    }

    // Main resets these every frame, so reapply.
    o.untargetable = true;
    o.blockFire = true;
    o.drawAlpha = this.ALPHA;
    o.speedMult = Math.max(o.speedMult, this.SPEED_BOOST);

    // Distortion ripples + wispy smoke.
    this.rippleTimer -= dt;
    if (this.rippleTimer <= 0 && this.ripples.length < 6) { this.rippleTimer = 0.45; this.ripples.push({ x: o.x, y: o.y, t: 0 }); }
    if (this.smoke.length < 60 && Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2;
      this.smoke.push({ x: o.x + Math.cos(a) * o.radius * 0.6, y: o.y + Math.sin(a) * o.radius * 0.6, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14 - 18, life: 0.7 + Math.random() * 0.5, r: 5 + Math.random() * 5 });
    }

    // Sparse trail of motes while moving (positions from last frame's movement).
    const moved = Math.hypot(o.x - this.lastX, o.y - this.lastY);
    this.lastX = o.x; this.lastY = o.y;
    this.moteTimer -= dt;
    if (moved > 0.5 && this.moteTimer <= 0) {
      this.moteTimer = this.MOTE_EVERY;
      this.motes.push({
        x: o.x + (Math.random() - 0.5) * 8,
        y: o.y + (Math.random() - 0.5) * 8,
        life: this.MOTE_LIFE * (0.6 + Math.random() * 0.4),
        r: 1.5 + Math.random() * 1.5,
      });
    }
  }

  // Online, the Voidwalker's own screen may show a faint marker; locally (shared screen) nothing gives them away.
  _ownerSees() {
    const net = Game.Net;
    if (!net || net.mode === 'local' || !Game.players) return false;
    return Game.players[net.mode === 'guest' ? 1 : 0] === this.owner;
  }

  draw(ctx) {
    const o = this.owner;
    const secret = this.inVoid && !this._ownerSees(); // hide in-void tells (smoke, ripples, motes, outline)
    ctx.save();

    const TAU = Math.PI * 2, now0 = performance.now() / 1000;
    // Wispy dark smoke.
    ctx.fillStyle = '#12061f';
    for (const m of (secret ? [] : this.smoke)) {
      const k = m.life / 1.2;
      ctx.globalAlpha = Math.min(0.4, k * 0.5);
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (1.6 - Math.min(1, k)), 0, TAU); ctx.fill();
    }
    // Distortion ripples.
    ctx.strokeStyle = '#8a5cd0'; ctx.lineWidth = 1.5;
    for (const r of (secret ? [] : this.ripples)) {
      const k = r.t / 0.9;
      ctx.globalAlpha = (1 - k) * 0.3;
      ctx.beginPath(); ctx.arc(r.x, r.y, 10 + 45 * k, 0, TAU); ctx.stroke();
    }

    // Trail motes: tiny fading dark-violet specks.
    for (const m of (secret ? [] : this.motes)) {
      ctx.globalAlpha = Math.min(1, m.life / this.MOTE_LIFE) * 0.55;
      ctx.fillStyle = '#5b2a9e';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }

    // Implosion: ring shrinking inward + particles sucked to the center.
    for (const e of this.implodes) {
      const k = e.t / this.IMPLODE_TIME;
      const r = 60 * (1 - k) + 6;
      ctx.globalAlpha = 0.85 * (1 - k * 0.5);
      ctx.strokeStyle = '#2a0f45';
      ctx.lineWidth = 6 * (1 - k) + 1.5;
      ctx.shadowColor = '#7a3cd6';
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0d0618';
      ctx.globalAlpha = 1 - k;
      for (const p of e.parts) {
        const d = p.d * (1 - k * k);
        ctx.beginPath(); ctx.arc(e.x + Math.cos(p.a) * d, e.y + Math.sin(p.a) * d, p.s, 0, Math.PI * 2); ctx.fill();
      }
      // Spiral arms rotating while collapsing.
      ctx.strokeStyle = '#9a5cf5'; ctx.lineWidth = 2.5 * (1 - k) + 0.5; ctx.globalAlpha = 0.8 * (1 - k);
      for (let arm = 0; arm < 3; arm++) {
        const a0 = arm * 2.094 + k * 9;
        ctx.beginPath();
        for (let j = 0; j <= 10; j++) {
          const u = j / 10, rr = (62 * (1 - k) + 4) * (1 - u * 0.85), aa = a0 + u * 3.2;
          const px = e.x + Math.cos(aa) * rr, py = e.y + Math.sin(aa) * rr;
          if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    }

    // Dark shimmer outline around the hidden owner.
    if (this.inVoid && o.alive && !secret) {
      const now = performance.now() / 1000;
      const lowTime = this.timeLeft < 0.6 ? 0.5 + 0.5 * Math.sin(now * 30) : 1; // flicker before ending
      ctx.globalAlpha = (0.22 + 0.1 * Math.sin(now * 7)) * lowTime;
      ctx.strokeStyle = '#6a2fc0';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -now * 20;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.radius + 3 + Math.sin(now * 5), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Slow rotating rune ring.
      const rr = o.radius + 14, rot = now0 * 0.8;
      ctx.strokeStyle = '#a77bff'; ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3 * lowTime;
      ctx.beginPath(); ctx.arc(o.x, o.y, rr, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.globalAlpha = 0.5 * lowTime;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = rot + i * (TAU / 8), l = (i % 2) ? 0.12 : 0.22;
        ctx.moveTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr);
        ctx.arc(o.x, o.y, rr, a, a + l);
      }
      ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#c9f6ff';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = -rot * 1.3 + i * (TAU / 4), r1 = rr - 4, r2 = rr + 4;
        ctx.moveTo(o.x + Math.cos(a) * r1, o.y + Math.sin(a) * r1);
        ctx.lineTo(o.x + Math.cos(a) * r2, o.y + Math.sin(a) * r2);
      }
      ctx.stroke();
    }

    // Exit tear: expanding violet ring + particles flung outward.
    for (const e of this.tears) {
      const k = e.t / this.TEAR_TIME;
      const r = 12 + 55 * Math.sqrt(k);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#b57bff';
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.shadowColor = '#8a4cf0';
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#7a3cd6';
      for (const p of e.parts) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 * (1 - k) + 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Rift cracks + shockwave.
    ctx.lineJoin = 'miter';
    for (const c of this.cracks) {
      const k = c.t / 0.45, open = Math.min(1, k * 4);
      ctx.globalAlpha = 1 - k;
      ctx.shadowColor = '#8a4cf0'; ctx.shadowBlur = 10;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? '#e6dcff' : '#7a3cd6';
        ctx.lineWidth = pass ? 1.2 : 4 * (1 - k) + 1;
        for (const pts of c.lines) {
          const cnt = Math.max(2, Math.ceil((pts.length / 2) * open));
          ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
          for (let j = 1; j < cnt; j++) ctx.lineTo(pts[j * 2], pts[j * 2 + 1]);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
    }
    for (const w of this.waves) {
      const k = w.t / 0.4;
      ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = '#c9f6ff'; ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(w.x, w.y, 15 + 90 * (1 - (1 - k) * (1 - k)), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  hud() {
    const state = this.inVoid ? 'active' : (this.cooldown > 0 ? 'cooldown' : 'ready');
    return {
      name: 'Void',
      key: this.owner.keyLabel('ability2'),
      cooldownFrac: this.cooldown / this.COOLDOWN,
      charge: this.inVoid ? Math.max(0, Math.min(1, this.timeLeft / this.DURATION)) : null,
      state,
    };
  }
};
