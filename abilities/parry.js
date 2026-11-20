// parry.js - Voidwalker ability3: a short parry window that negates hits, reflects bullets
// (combat.js) and punishes close attackers with a stun + knockback.
window.Game = window.Game || {};
Game.Abilities = Game.Abilities || {};

Game.Abilities.Parry = class Parry {
  constructor(owner) {
    this.owner = owner;
    this.WINDOW = 0.35;
    this.COOLDOWN_HIT = 1.5;   // reward for a successful parry
    this.COOLDOWN_WHIFF = 4.0; // punishment for a miss
    this.STUN_RANGE = 130;
    this.STUN_TIME = 1.0;
    this.KNOCKBACK = 30;
    this.MAX_PARTS = 120;
    this.opp = null; // latest opponent (onParried gets no env)
    owner.onParried = (info) => this._onParried(info);
    this.reset();
  }

  reset() {
    this.open = false;
    this.timeLeft = 0;
    this.cooldown = 0;
    this.succeeded = false;
    this.rings = [];  // {x, y, t}
    this.parts = [];  // {x, y, vx, vy, life, max, kind:'shard'|'frag', a, len}
    this.sparks = []; // {x, y, t}
    this.owner.parryActive = false;
  }

  _spawn(p) { if (this.parts.length < this.MAX_PARTS) this.parts.push(p); }

  _onParried(info) {
    if (!this.open) return;
    if (this.succeeded) return; // later hits are still negated, no extra payoff
    this.succeeded = true;
    const o = this.owner, opp = this.opp;
    info = info || {};
    const sx = info.x != null ? info.x : o.x, sy = info.y != null ? info.y : o.y;

    // Punish nearby opponent.
    if (opp && opp.alive && !opp.untargetable) {
      const dx = opp.x - o.x, dy = opp.y - o.y, d = Math.hypot(dx, dy);
      if (d <= this.STUN_RANGE) {
        opp.stun(this.STUN_TIME);
        const nx = d > 0.001 ? dx / d : o.facing.x, ny = d > 0.001 ? dy / d : o.facing.y;
        opp.x += nx * this.KNOCKBACK; opp.y += ny * this.KNOCKBACK;
        Game.Arena.resolveCircle(opp);
      }
    }

    // VFX burst.
    this.rings.push({ x: o.x, y: o.y, t: 0 }, { x: sx, y: sy, t: -0.05 });
    this.sparks.push({ x: sx, y: sy, t: 0 });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, sp = 160 + Math.random() * 260, life = 0.25 + Math.random() * 0.2;
      this._spawn({ kind: 'shard', x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, a, len: 6 + Math.random() * 8 });
    }
    Game.FX.hitStop(0.08);
    Game.FX.shake(5, 0.15);
    Game.FX.flash('#e0d4ff', 0.2, 0.1);
  }

  _close() {
    const o = this.owner;
    if (!this.open) return;
    this.open = false;
    o.parryActive = false;
    if (this.succeeded) { this.cooldown = this.COOLDOWN_HIT; return; }
    // Whiff: shield shatters into dim fading fragments.
    this.cooldown = this.COOLDOWN_WHIFF;
    const base = Math.atan2(o.facing.y, o.facing.x);
    for (let i = 0; i < 7; i++) {
      const a = base + (Math.random() - 0.5) * 2.2, r = o.radius + 16, life = 0.4 + Math.random() * 0.3;
      this._spawn({ kind: 'frag', x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, vx: Math.cos(a) * 40 + (Math.random() - 0.5) * 30, vy: Math.sin(a) * 40 + (Math.random() - 0.5) * 30 + 20, life, max: life, a, len: 4 + Math.random() * 4 });
    }
  }

  update(dt, env) {
    const o = this.owner;
    if (env.opponent) this.opp = env.opponent;
    this.cooldown = Math.max(0, this.cooldown - dt);

    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.35);
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter((s) => s.t < 0.2);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);

    if (!this.open && env.pressed && env.active && o.alive && this.cooldown <= 0) {
      this.open = true; this.timeLeft = this.WINDOW; this.succeeded = false;
    }
    if (!this.open) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0 || !o.alive) { this._close(); return; }
    o.parryActive = true;
    o.speedMult = Math.min(o.speedMult, 0.5);
    o.blockFire = true;
  }

  draw(ctx) {
    const o = this.owner, TAU = Math.PI * 2;
    ctx.save();

    // Shield: violet crescent with a cyan-white edge, flickering.
    if (this.open && o.alive) {
      const now = performance.now() / 1000;
      const k = this.timeLeft / this.WINDOW;
      const flick = 0.75 + 0.25 * Math.sin(now * 60);
      const base = Math.atan2(o.facing.y, o.facing.x), r = o.radius + 14;
      ctx.lineCap = 'round';
      // faint full ring
      ctx.globalAlpha = 0.25 * flick; ctx.strokeStyle = '#8a5cd0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.radius + 8, 0, TAU); ctx.stroke();
      // violet body of the crescent (big shape, glows)
      ctx.globalAlpha = 0.8 * flick; ctx.strokeStyle = '#7a3cd6'; ctx.lineWidth = 9;
      ctx.shadowColor = '#a77bff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, base - 1.1, base + 1.1); ctx.stroke();
      // cyan-white edge
      ctx.shadowColor = '#7fffff'; ctx.shadowBlur = 10;
      ctx.globalAlpha = flick; ctx.strokeStyle = '#d8ffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(o.x, o.y, r + 4, base - 1.1, base + 1.1); ctx.stroke();
      ctx.shadowBlur = 0;
      // tips fading out as the window closes
      ctx.globalAlpha = 0.6 * k; ctx.fillStyle = '#ffffff';
      for (const s of [-1.1, 1.1]) {
        ctx.beginPath(); ctx.arc(o.x + Math.cos(base + s) * (r + 4), o.y + Math.sin(base + s) * (r + 4), 2.5, 0, TAU); ctx.fill();
      }
    }

    // Burst rings (white-violet).
    for (const rg of this.rings) {
      if (rg.t < 0) continue;
      const k = rg.t / 0.35;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = k < 0.4 ? '#ffffff' : '#b388ff';
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.shadowColor = '#c9b0ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, 12 + 70 * k, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Spark star at the impact point.
    for (const s of this.sparks) {
      const k = s.t / 0.2, l = 22 * (1 - k) + 4;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 4;
        ctx.moveTo(s.x - Math.cos(a) * l, s.y - Math.sin(a) * l);
        ctx.lineTo(s.x + Math.cos(a) * l, s.y + Math.sin(a) * l);
      }
      ctx.stroke();
    }

    // Shards (bright) and fragments (dim).
    for (const p of this.parts) {
      const f = p.life / p.max, dx = Math.cos(p.a) * p.len, dy = Math.sin(p.a) * p.len;
      if (p.kind === 'shard') {
        ctx.globalAlpha = f; ctx.strokeStyle = f > 0.5 ? '#f0e8ff' : '#9a5cf5'; ctx.lineWidth = 2;
      } else {
        ctx.globalAlpha = f * 0.45; ctx.strokeStyle = '#6a2fc0'; ctx.lineWidth = 2;
      }
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke();
    }

    ctx.restore();
  }

  hud() {
    const cdTotal = this.succeeded ? this.COOLDOWN_HIT : this.COOLDOWN_WHIFF;
    return {
      name: 'Parry',
      key: this.owner.keyLabel('ability3'),
      cooldownFrac: this.open ? 0 : Math.min(1, this.cooldown / cdTotal),
      charge: this.open ? Math.max(0, this.timeLeft / this.WINDOW) : null,
      state: this.open ? 'active' : (this.cooldown > 0 ? 'cooldown' : 'ready'),
    };
  }
};
