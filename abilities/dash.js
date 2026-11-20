// dash.js - Voidwalker ability1: dash forward through the enemy for a slash hit.
window.Game = window.Game || {};
Game.Abilities = Game.Abilities || {};

Game.Abilities.DashStrike = class DashStrike {
  constructor(owner) {
    this.owner = owner;
    this.DISTANCE = 200;
    this.DURATION = 0.16;
    this.COOLDOWN = 3.0;
    this.DAMAGE = 22;
    this.KNOCKBACK = 40;
    this.STEP = 8;          // max movement per collision step
    this.SLASH_TIME = 0.25;
    this.reset();
  }

  reset() {
    this.dashing = false;
    this.t = 0;
    this.dir = { x: 1, y: 0 };
    this.hit = false;
    this.cooldown = 0;
    this.after = [];   // afterimages {x, y, life}
    this.slashes = []; // {x, y, ang, t}
    this.sparks = [];  // {x, y, vx, vy, life}
    this.dust = [];    // {x, y, vx, vy, t}
    this.trailAcc = 0;
    this.ghostAcc = 0;
    this.ribbon = [];   // {x, y, t} void ribbon points
    this.ghosts = [];   // {x, y, ang, life} stretched afterimages
    this.shards = [];   // {x, y, vx, vy, rot, vr, life, s}
    this.scuffs = [];   // {x, y, vx, vy, t}
    this.crosses = [];  // {x, y, ang, t}
    this.winds = [];    // {x, y, t}
    this.rings = [];    // {x, y, t}
  }

  _cap(arr, n) { if (arr.length > n) arr.splice(0, arr.length - n); }

  _end() {
    this.dashing = false;
    this.cooldown = this.COOLDOWN;
  }

  _slash(x, y, ang) {
    this.slashes.push({ x, y, ang, t: 0 });
    for (let i = 0; i < 8; i++) {
      const a = ang + (Math.random() - 0.5) * 2.2, sp = 120 + Math.random() * 240;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.15 + Math.random() * 0.15 });
    }
    this.crosses.push({ x, y, ang, t: 0 });
    this.rings.push({ x, y, t: 0 });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 300;
      this.shards.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 20, life: 0.3 + Math.random() * 0.25, s: 3 + Math.random() * 4 });
    }
    this._cap(this.shards, 100); this._cap(this.sparks, 100);
    Game.FX.shake(6, 0.18);
    Game.FX.hitStop(0.06);
    Game.FX.flash('#b388ff', 0.14, 0.08);
  }

  update(dt, env) {
    const o = this.owner, A = Game.Arena;
    this.cooldown = Math.max(0, this.cooldown - dt);

    // Age effects.
    for (const a of this.after) a.life -= dt;
    this.after = this.after.filter((a) => a.life > 0);
    for (const s of this.slashes) s.t += dt;
    this.slashes = this.slashes.filter((s) => s.t < this.SLASH_TIME);
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const d of this.dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.t += dt; }
    this.dust = this.dust.filter((d) => d.t < 0.3);
    for (const g of this.ghosts) g.life -= dt;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    for (const r of this.ribbon) r.t += dt;
    while (this.ribbon.length && this.ribbon[0].t > 0.3) this.ribbon.shift();
    for (const p of this.shards) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; p.rot += p.vr * dt; p.life -= dt; }
    this.shards = this.shards.filter((p) => p.life > 0);
    for (const d of this.scuffs) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.94; d.vy *= 0.94; d.t += dt; }
    this.scuffs = this.scuffs.filter((d) => d.t < 0.35);
    for (const c of this.crosses) c.t += dt;
    this.crosses = this.crosses.filter((c) => c.t < 0.3);
    for (const w of this.winds) w.t += dt;
    this.winds = this.winds.filter((w) => w.t < 0.14);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.3);

    // Start.
    if (!this.dashing && env.pressed && env.active && o.alive && this.cooldown <= 0) {
      const f = o.facing;
      const m = Math.hypot(f.x, f.y) || 1;
      this.dir = { x: f.x / m, y: f.y / m };
      this.dashing = true;
      this.t = 0;
      this.hit = false;
      this.trailAcc = 0;
      this.ghostAcc = 0;
      this.winds.push({ x: o.x, y: o.y, t: 0 });
      this.ribbon.push({ x: o.x, y: o.y, t: 0 });
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 60;
        this.dust.push({ x: o.x, y: o.y + o.radius * 0.5, vx: Math.cos(a) * sp - this.dir.x * 40, vy: Math.sin(a) * sp - this.dir.y * 40, t: 0 });
      }
    }
    if (!this.dashing) return;

    if (!env.active || !o.alive) { this._end(); return; }

    o.speedMult = 0;
    o.blockFire = true;

    // Advance along the locked direction in small steps.
    const step = Math.min(dt, this.DURATION - this.t);
    let remain = this.DISTANCE * (step / this.DURATION);
    let blocked = false;
    while (remain > 0.0001 && !blocked) {
      const s = Math.min(this.STEP, remain);
      const px = o.x + this.dir.x * s, py = o.y + this.dir.y * s;
      o.x = px; o.y = py;
      if (A && A.resolveCircle) A.resolveCircle(o);
      // Pushed back by a wall: stop.
      if (Math.hypot(o.x - px, o.y - py) > 0.5) blocked = true;
      remain -= s;
    }
    this.t += step;

    // Afterimages along the path.
    this.trailAcc += step;
    if (this.trailAcc >= this.DURATION / 5) {
      this.trailAcc = 0;
      this.after.push({ x: o.x, y: o.y, life: 0.22 });
    }
    this.ghostAcc += step;
    if (this.ghostAcc >= this.DURATION / 12) {
      this.ghostAcc = 0;
      this.ghosts.push({ x: o.x, y: o.y, ang: Math.atan2(this.dir.y, this.dir.x), life: 0.28 });
      this._cap(this.ghosts, 30);
      // ground scuff
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50;
        this.scuffs.push({ x: o.x - this.dir.x * o.radius, y: o.y + o.radius * 0.6, vx: Math.cos(a) * sp - this.dir.x * 30, vy: Math.sin(a) * sp * 0.4 - 10, t: 0 });
      }
      this._cap(this.scuffs, 60);
    }
    this.ribbon.push({ x: o.x, y: o.y, t: 0 });
    this._cap(this.ribbon, 40);

    // One hit per dash; the dash passes through the enemy.
    const opp = env.opponent;
    if (!this.hit && opp && opp.alive && !opp.untargetable) {
      if (Math.hypot(opp.x - o.x, opp.y - o.y) < o.radius + opp.radius) {
        this.hit = true;
        opp.takeDamage(this.DAMAGE);
        opp.x += this.dir.x * this.KNOCKBACK;
        opp.y += this.dir.y * this.KNOCKBACK;
        if (A && A.resolveCircle) A.resolveCircle(opp);
        this._slash((o.x + opp.x) / 2, (o.y + opp.y) / 2, Math.atan2(this.dir.y, this.dir.x));
      }
    }

    if (blocked) {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
        this.scuffs.push({ x: o.x + this.dir.x * o.radius, y: o.y + this.dir.y * o.radius, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 });
      }
      this._cap(this.scuffs, 60);
      Game.FX.shake(2, 0.08);
    }
    if (blocked || this.t >= this.DURATION - 1e-6) this._end();
  }

  draw(ctx) {
    const o = this.owner;
    ctx.save();

    const TAU = Math.PI * 2;
    // Void ribbon trail (lingers 0.3s).
    if (this.ribbon.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = '#8a4cf0'; ctx.shadowBlur = 14;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? '#c9f6ff' : '#4a1d8a';
        for (let i = 1; i < this.ribbon.length; i++) {
          const a = this.ribbon[i - 1], b = this.ribbon[i];
          const k = Math.min(1, b.t / 0.3);
          ctx.globalAlpha = (1 - k) * (pass ? 0.7 : 0.8);
          ctx.lineWidth = (pass ? 3 : o.radius * 1.3) * (1 - k * 0.8);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
    }

    // Scuff / dust particles (violet-grey).
    ctx.fillStyle = '#7f6a9c';
    for (const d of this.scuffs) {
      const k = d.t / 0.35;
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.beginPath(); ctx.arc(d.x, d.y, 2 + 5 * k, 0, TAU); ctx.fill();
    }

    // Stretched motion-blur afterimages.
    for (const g of this.ghosts) {
      const k = g.life / 0.28;
      ctx.save();
      ctx.translate(g.x, g.y); ctx.rotate(g.ang);
      ctx.globalAlpha = k * 0.45;
      ctx.fillStyle = '#6a2fc0';
      ctx.beginPath(); ctx.ellipse(0, 0, o.radius * (1.3 + 0.8 * k), o.radius * (0.6 + 0.3 * k), 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = k * 0.3;
      ctx.fillStyle = '#c9f6ff';
      ctx.beginPath(); ctx.ellipse(0, 0, o.radius * 0.9 * (1 + k), o.radius * 0.3, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // Wind-up: converging flickering rings.
    for (const w of this.winds) {
      const k = w.t / 0.14;
      ctx.globalAlpha = (1 - k) * (Math.sin(w.t * 120) > 0 ? 0.9 : 0.4);
      ctx.strokeStyle = '#c9f6ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w.x, w.y, o.radius * (2.4 - 1.6 * k), 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#8a4cf0';
      ctx.beginPath(); ctx.arc(w.x, w.y, o.radius * (3.2 - 2.2 * k), 0, TAU); ctx.stroke();
    }

    // Dust puff.
    ctx.fillStyle = '#cfcfcf';
    for (const d of this.dust) {
      const k = d.t / 0.3;
      ctx.globalAlpha = (1 - k) * 0.45;
      ctx.beginPath(); ctx.arc(d.x, d.y, 4 + 8 * k, 0, Math.PI * 2); ctx.fill();
    }

    // Afterimages.
    ctx.fillStyle = o.color;
    for (const a of this.after) {
      ctx.globalAlpha = Math.max(0, a.life / 0.22) * 0.4;
      ctx.beginPath(); ctx.arc(a.x, a.y, o.radius, 0, Math.PI * 2); ctx.fill();
    }

    // Speed streaks behind the owner.
    if (this.dashing) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      const px = -this.dir.y, py = this.dir.x;
      for (let i = -2; i <= 2; i++) {
        const off = i * o.radius * 0.45;
        const len = 30 + Math.abs(i) * -4 + 24 * (1 - Math.abs(i) / 3);
        const sx = o.x + px * off - this.dir.x * o.radius * 0.5;
        const sy = o.y + py * off - this.dir.y * o.radius * 0.5;
        ctx.globalAlpha = 0.6 - Math.abs(i) * 0.12;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - this.dir.x * len, sy - this.dir.y * len); ctx.stroke();
      }
    }

    // Crescent slashes.
    for (const s of this.slashes) {
      const k = s.t / this.SLASH_TIME;
      const R = 28 + 14 * k;
      const half = 1.1 - 0.3 * k;
      ctx.lineCap = 'round';
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 14;
      // Outer colored arc, inner white arc.
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 9 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, R, s.ang - half, s.ang + half); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, R - 2, s.ang - half * 0.9, s.ang + half * 0.9); ctx.stroke();
    }

    // Crossing double slash.
    ctx.lineCap = 'round';
    for (const c of this.crosses) {
      const k = c.t / 0.3, L = 34 + 40 * k;
      ctx.shadowColor = '#8a4cf0'; ctx.shadowBlur = 12;
      for (let j = 0; j < 2; j++) {
        const a = c.ang + (j ? 0.7 : -0.7), dx = Math.cos(a) * L, dy = Math.sin(a) * L;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#7a3cd6'; ctx.lineWidth = 8 * (1 - k) + 1;
        ctx.beginPath(); ctx.moveTo(c.x - dx, c.y - dy); ctx.lineTo(c.x + dx, c.y + dy); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.beginPath(); ctx.moveTo(c.x - dx, c.y - dy); ctx.lineTo(c.x + dx, c.y + dy); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    for (const r of this.rings) {
      const k = r.t / 0.3;
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#c9f6ff'; ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, 10 + 50 * Math.sqrt(k), 0, TAU); ctx.stroke();
    }
    // Violet shards.
    ctx.fillStyle = '#9a5cf5';
    for (const p of this.shards) {
      ctx.globalAlpha = Math.min(1, p.life / 0.2);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.beginPath(); ctx.moveTo(p.s, 0); ctx.lineTo(-p.s * 0.6, p.s * 0.5); ctx.lineTo(-p.s * 0.6, -p.s * 0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Sparks.
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    for (const p of this.sparks) {
      ctx.globalAlpha = Math.min(1, p.life / 0.15);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.restore();
  }

  hud() {
    return {
      name: 'Dash',
      key: this.owner.keyLabel('ability1'),
      cooldownFrac: this.dashing ? 1 : this.cooldown / this.COOLDOWN,
      charge: null,
      state: this.dashing ? 'active' : (this.cooldown > 0 ? 'cooldown' : 'ready'),
    };
  }
};
