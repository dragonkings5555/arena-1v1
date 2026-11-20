// mine.js - Ninja ability4: drop hidden land mines that damage and stun the enemy.
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

Game.Abilities.LandMine = class LandMine {
  constructor(owner) {
    this.owner = owner;
    this.COOLDOWN = 2.0;     // placement cooldown
    this.MAX_MINES = 3;      // placing a 4th removes the oldest
    this.ARM_TIME = 0.8;
    this.RADIUS = 10;
    this.DAMAGE = 15;
    this.STUN = 1.0;
    this.BLAST_TIME = 0.4;
    this.BLAST_RADIUS = 60;
    this.reset();
  }

  reset() {
    this.cooldown = 0;
    this.mines = [];   // {x, y, age}
    this.blasts = [];  // {x, y, t}
    this.sparks = [];  // particles: dust, fire, smoke, debris
    this.ripples = []; // {x, y, t} plant ripples
    this.scorches = []; // {x, y, t, r} floor scorch marks
  }

  _explode(m) {
    this.blasts.push({ x: m.x, y: m.y, t: 0 });
    this.scorches.push({ x: m.x, y: m.y, t: 0, r: 26 + Math.random() * 8 });
    if (this.scorches.length > 6) this.scorches.shift();
    burst(this.sparks, m.x, m.y, 22, 80, 340, 0.4, 2.5, '#ffd34d', 1, 3);          // sparks
    burst(this.sparks, m.x, m.y, 16, 40, 220, 0.5, 9, 'rgba(255,120,20,0.7)', 2, 3);  // fire
    burst(this.sparks, m.x, m.y, 8, 30, 140, 0.35, 11, 'rgba(255,220,100,0.8)', 2, 3);
    burst(this.sparks, m.x, m.y, 12, 12, 70, 0.8, 12, 'rgba(70,70,75,0.5)', 2, 1.5);  // smoke ~0.8s
    Game.FX.shake(7, 0.25);
    Game.FX.hitStop(0.06);
  }

  update(dt, env) {
    const o = this.owner;
    this.cooldown = Math.max(0, this.cooldown - dt);

    // Effects.
    stepP(this.sparks, dt);
    for (const b of this.blasts) b.t += dt;
    this.blasts = this.blasts.filter((b) => b.t < this.BLAST_TIME);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 0.5);
    for (const s of this.scorches) s.t += dt;
    this.scorches = this.scorches.filter((s) => s.t < 2);

    // Place a mine.
    if (env.pressed && env.active && o.alive && this.cooldown <= 0) {
      this.mines.push({ x: o.x, y: o.y, age: 0 });
      if (this.mines.length > this.MAX_MINES) this.mines.shift();
      this.cooldown = this.COOLDOWN;
      // Plant dust puff + ripple.
      burst(this.sparks, o.x, o.y, 7, 25, 90, 0.45, 6, 'rgba(190,180,160,0.5)', 2, 3);
      this.ripples.push({ x: o.x, y: o.y, t: 0 });
    }

    // Arm and trigger (only against the opponent, never the owner).
    const opp = env.opponent;
    const remaining = [];
    for (const m of this.mines) {
      m.age += dt;
      if (m.age >= this.ARM_TIME && opp && opp.alive &&
          Math.hypot(opp.x - m.x, opp.y - m.y) < this.RADIUS + opp.radius) {
        opp.takeDamage(this.DAMAGE);
        opp.stun(this.STUN);
        this._explode(m);
      } else {
        remaining.push(m);
      }
    }
    this.mines = remaining;
  }

  draw(ctx) {
    const o = this.owner;
    ctx.save();

    // Scorch marks on the floor (under everything else).
    for (const s of this.scorches) {
      const f = s.t / 2;
      ctx.globalAlpha = (1 - f) * 0.45;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, 'rgba(10,8,6,0.9)');
      g.addColorStop(0.6, 'rgba(25,18,12,0.6)');
      g.addColorStop(1, 'rgba(25,18,12,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }

    // Plant ripples.
    for (const r of this.ripples) {
      const q = r.t / 0.5;
      ring(ctx, r.x, r.y, 6 + 22 * q, 2, '#d8d0b8', (1 - q) * 0.6);
    }

    for (const m of this.mines) {
      if (m.age < this.ARM_TIME) {
        // Arming: clearly visible disc with a blinking light.
        ctx.globalAlpha = 1;
        ctx.fillStyle = o.color;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (Math.floor(m.age * 12) % 2 === 0) {
          ctx.fillStyle = '#ff3b3b';
          ctx.shadowColor = '#ff3b3b';
          ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          // Blink pulse ring.
          ring(ctx, m.x, m.y, 9 + ((m.age * 12) % 1) * 8, 1.5, '#ff3b3b', 0.5);
        }
      } else {
        // Armed: nearly invisible faint dot.
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fill();
        // Brief "armed" pulse ring right as it arms.
        const q = (m.age - this.ARM_TIME) / 0.3;
        if (q < 1) ring(ctx, m.x, m.y, 6 + 18 * q, 2, '#ff9a1f', (1 - q) * 0.5);
      }
    }

    // Explosions: flash + expanding rings.
    for (const b of this.blasts) {
      const k = b.t / this.BLAST_TIME;
      const r = this.BLAST_RADIUS * (0.25 + 0.75 * Math.sqrt(k));
      ctx.globalAlpha = (1 - k) * 0.8;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 1.2);
      g.addColorStop(0, '#fffbe0');
      g.addColorStop(0.4, 'rgba(255,190,50,0.8)');
      g.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.2, 0, Math.PI * 2); ctx.fill();
      ring(ctx, b.x, b.y, r, 4 * (1 - k) + 1, '#ff9a1f', 1 - k);
      ring(ctx, b.x, b.y, r * 0.65, 2.5 * (1 - k) + 1, '#ffe08a', 1 - k);
    }

    // Particles: sparks, fire, smoke.
    ctx.lineCap = 'round';
    drawP(ctx, this.sparks);
    ctx.restore();
  }

  hud() {
    return {
      name: 'Mine',
      key: this.owner.keyLabel('ability4'),
      cooldownFrac: this.cooldown / this.COOLDOWN,
      charge: null,
      state: this.cooldown > 0 ? 'cooldown' : 'ready',
      count: this.mines.length,
    };
  }
};
})();
