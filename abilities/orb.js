// orb.js - Ninja ability2: hold a crackling energy orb (with a speed boost) that explodes on the enemy.
(function () {

  // ---- tiny particle helpers (local to this file) ----
  const CAP = 150;
  function addP(arr, x, y, vx, vy, life, size, color, kind, fric) {
    if (arr.length >= CAP) return;
    arr.push({ x, y, vx, vy, life, max: life, size, color, kind: kind || 0, f: fric || 0 });
  }
  function burst(arr, x, y, n, spMin, spMax, life, size, color, kind, fric) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = spMin + Math.random() * (spMax - spMin);
      addP(arr, x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * (0.6 + Math.random() * 0.4), size, color, kind, fric);
    }
  }
  function stepP(arr, dt) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.f) { const d = Math.max(0, 1 - p.f * dt); p.vx *= d; p.vy *= d; }
      arr[j++] = p;
    }
    arr.length = j;
  }
  function drawP(ctx, arr) {
    for (const p of arr) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      if (p.kind === 1) { // streak
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      } else if (p.kind === 2) { // expanding puff (dust/smoke)
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - t * 0.6), 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        const s = p.size * (0.4 + 0.6 * t);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
  }
  function ring(ctx, x, y, r, w, color, a) {
    ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); ctx.stroke();
  }

window.Game = window.Game || {};
Game.Abilities = Game.Abilities || {};

Game.Abilities.EnergyOrb = class EnergyOrb {
  constructor(owner) {
    this.owner = owner;
    this.RADIUS = 14;
    this.MAX_ENERGY = 2.5;   // seconds of hold
    this.COOLDOWN = 5.0;
    this.DAMAGE = 30;        // one big burst on contact
    this.SPEED_BOOST = 1.5;  // owner moves faster while holding the orb
    this.KNOCKBACK = 70;     // px the target is blasted away
    this.BLAST_TIME = 0.35;  // explosion shockwave duration
    this.BLAST_RADIUS = 70;
    this.FADE = 0.15;
    this.reset();
  }

  reset() {
    this.holding = false;
    this.energy = this.MAX_ENERGY;
    this.cooldown = 0;
    this.fade = 0;       // remaining fade-out time
    this.sparks = [];    // all particles (sparks, wisps, debris)
    this.blasts = [];    // {x, y, t} explosion shockwaves
    this.x = this.owner.x;
    this.y = this.owner.y;
    this.px = this.x;
    this.py = this.y;
  }

  _target() {
    const o = this.owner;
    const d = o.radius + 20;
    return { x: o.x + o.facing.x * d, y: o.y + o.facing.y * d };
  }

  _end() {
    if (!this.holding) return;
    this.holding = false;
    this.fade = this.FADE;
    this.cooldown = this.COOLDOWN;
  }

  update(dt, env) {
    const o = this.owner;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.fade = Math.max(0, this.fade - dt);

    // Particles (sparks, wisps, debris) with friction.
    stepP(this.sparks, dt);
    for (const b of this.blasts) b.t += dt;
    this.blasts = this.blasts.filter((b) => b.t < 0.6);

    // Start.
    if (!this.holding && env.held && env.active && o.alive && this.cooldown <= 0) {
      this.holding = true;
      this.energy = this.MAX_ENERGY;
      this.fade = 0;
      const t = this._target();
      this.x = t.x; this.y = t.y;
      this.px = this.x; this.py = this.y;
      // Charge-up flare.
      burst(this.sparks, this.x, this.y, 10, 60, 200, 0.3, 2, '#c9a8ff', 1, 5);
    }

    if (!this.holding) {
      if (this.cooldown > 0 === false && this.fade <= 0) this.energy = this.MAX_ENERGY;
      return;
    }

    // End conditions.
    this.energy -= dt;
    if (!env.held || this.energy <= 0 || !env.active || !o.alive) {
      this.energy = Math.max(0, this.energy);
      this._end();
      return;
    }

    o.speedMult = Math.max(o.speedMult, this.SPEED_BOOST);
    o.blockFire = true;

    // Swing toward the held spot.
    const t = this._target();
    const k = 1 - Math.exp(-18 * dt);
    this.x += (t.x - this.x) * k;
    this.y += (t.y - this.y) * k;

    // Trailing wisps as the boosted owner moves.
    const moved = Math.hypot(this.x - this.px, this.y - this.py);
    if (moved > 0.5 || Math.random() < 0.3) {
      addP(this.sparks, this.x + (Math.random() - 0.5) * 8, this.y + (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.4, 7, Math.random() < 0.5 ? 'rgba(150,120,255,0.55)' : 'rgba(183,243,255,0.55)', 2, 2);
    }
    this.px = this.x; this.py = this.y;

    // Explode on contact with the enemy: one burst of damage + knockback, orb is used up.
    const opp = env.opponent;
    if (opp && opp.alive) {
      const dx = opp.x - this.x, dy = opp.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.RADIUS + opp.radius) {
        opp.takeDamage(this.DAMAGE);
        const nx = dist > 0.001 ? dx / dist : o.facing.x;
        const ny = dist > 0.001 ? dy / dist : o.facing.y;
        opp.x += nx * this.KNOCKBACK;
        opp.y += ny * this.KNOCKBACK;
        if (Game.Arena && Game.Arena.resolveCircle) Game.Arena.resolveCircle(opp);
        this._explode();
      }
    }
  }

  _explode() {
    this.blasts.push({ x: this.x, y: this.y, t: 0 });
    burst(this.sparks, this.x, this.y, 24, 120, 380, 0.45, 2.5, '#ffffff', 1, 3);
    burst(this.sparks, this.x, this.y, 18, 60, 260, 0.9, 4, '#c9a8ff', 0, 3.5);   // debris with friction
    burst(this.sparks, this.x, this.y, 10, 40, 160, 0.8, 4, '#b7f3ff', 0, 3);
    burst(this.sparks, this.x, this.y, 6, 10, 70, 0.6, 14, 'rgba(150,120,255,0.35)', 2, 2.5);
    this._end();
    this.fade = 0; // the blast replaces the fade-out
    Game.FX.shake(8, 0.25);
    Game.FX.hitStop(0.07);
    Game.FX.flash('#c9a8ff', 0.18, 0.15);
  }

  draw(ctx) {
    const showing = this.holding || this.fade > 0;
    const o = this.owner;
    const now = performance.now();
    ctx.save();
    if (showing) {
      const alpha = this.holding ? 1 : this.fade / this.FADE;
      const R = this.RADIUS;
      // Energy color: violet/cyan mixed with owner color via layered glow.
      const rgba = (a) => `rgba(150,120,255,${a})`;
      ctx.globalAlpha = alpha;

      // Faint arm line.
      ctx.strokeStyle = o.color;
      ctx.globalAlpha = alpha * 0.35;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(this.x, this.y); ctx.stroke();
      ctx.globalAlpha = alpha;

      // Outer halo (big soft layer).
      const pulse = 1 + Math.sin(now / 60) * 0.08;
      const halo = ctx.createRadialGradient(this.x, this.y, R * 0.8, this.x, this.y, R * 3.2 * pulse);
      halo.addColorStop(0, 'rgba(150,120,255,0.35)');
      halo.addColorStop(1, 'rgba(150,120,255,0)');
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(this.x, this.y, R * 3.2 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;

      // Glowing core.
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R * 1.6 * pulse);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, '#b7f3ff');
      g.addColorStop(0.7, rgba(0.8));
      g.addColorStop(1, rgba(0));
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.x, this.y, R * 1.6 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Orbiting particles (procedural, no allocation).
      for (let i = 0; i < 6; i++) {
        const a = now / 220 * (i % 2 ? -1 : 1) + i * 1.047;
        const rr = R * (1.5 + 0.35 * Math.sin(now / 150 + i));
        ctx.fillStyle = i % 2 ? '#e8fbff' : '#c9a8ff';
        ctx.globalAlpha = alpha * 0.9;
        ctx.beginPath(); ctx.arc(this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = alpha;

      // Flickering jagged lightning arcs, re-randomized every frame.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        let a = Math.random() * Math.PI * 2;
        let r = R * 0.4;
        ctx.strokeStyle = Math.random() < 0.5 ? '#e8fbff' : '#c9a8ff';
        ctx.lineWidth = 1 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
        const steps = 4;
        for (let s = 0; s < steps; s++) {
          a += (Math.random() - 0.5) * 1.2;
          r += (R * 1.1) / steps + Math.random() * 3;
          ctx.lineTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
        }
        ctx.stroke();
      }
    }

    // Explosion: light flash, glow, multi-ring shockwave.
    for (const b of this.blasts) {
      const kk = b.t / this.BLAST_TIME;       // 0..1 over the main blast
      const k = Math.min(1, kk);
      const r = this.BLAST_RADIUS * (0.3 + 0.7 * Math.sqrt(k));
      if (kk < 1) {
        ctx.globalAlpha = (1 - k) * 0.6;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, 'rgba(183,243,255,0.7)');
        g.addColorStop(1, 'rgba(150,120,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      }
      // Brief big light flash.
      if (b.t < 0.1) {
        ctx.globalAlpha = (1 - b.t / 0.1) * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x, b.y, this.BLAST_RADIUS * 1.9, 0, Math.PI * 2); ctx.fill();
      }
      // Three staggered shock rings.
      for (let i = 0; i < 3; i++) {
        const q = (b.t - i * 0.06) / 0.45;
        if (q <= 0 || q >= 1) continue;
        ring(ctx, b.x, b.y, this.BLAST_RADIUS * (0.2 + 1.3 * Math.sqrt(q)), 5 * (1 - q) + 1, i === 1 ? '#b7f3ff' : '#c9a8ff', 1 - q);
      }
    }

    // Particles (can outlive the orb briefly).
    ctx.shadowBlur = 0;
    ctx.lineCap = 'round';
    drawP(ctx, this.sparks);
    ctx.restore();
  }

  hud() {
    const state = this.holding ? 'active' : (this.cooldown > 0 ? 'cooldown' : 'ready');
    return {
      name: 'Orb',
      key: this.owner.keyLabel('ability2'),
      cooldownFrac: this.cooldown / this.COOLDOWN,
      charge: this.holding ? Math.max(0, this.energy / this.MAX_ENERGY) : null,
      state,
    };
  }
};
})();
