// kunai.js - Ninja kunai kit.
//   KunaiThrow    (ability1): throw up to 2 permanent kunai; they stick to walls and enemies.
//   KunaiTeleport (ability3): blink to the OLDEST kunai and consume it.
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

Game.Abilities.KunaiThrow = class KunaiThrow {
  constructor(owner) {
    this.owner = owner;
    this.SPEED = 700;
    this.MAX_DIST = 650;
    this.DAMAGE = 12;
    this.COOLDOWN = 0.5;
    this.MAX_KUNAI = 2;
    this.POOF_TIME = 0.3;
    this.reset();
  }

  reset() {
    // kunai: { x, y, vx, vy, state:'flying'|'stuck'|'dropped', dist, age, target, ox, oy }
    this.kunais = [];
    this.poofs = [];   // { x, y, t } fade where a kunai was removed
    this.parts = [];   // visual particles
    this.cd = 0;
  }

  // Remove a kunai (used by throw-overflow and by teleport) leaving a small poof.
  removeKunai(k) {
    const i = this.kunais.indexOf(k);
    if (i >= 0) this.kunais.splice(i, 1);
    this.poofs.push({ x: k.x, y: k.y, t: 0 });
    burst(this.parts, k.x, k.y, 6, 30, 110, 0.3, 2, '#d5dde6', 0, 4);
  }

  update(dt, env) {
    const o = this.owner;
    if (this.cd > 0) this.cd = Math.max(0, this.cd - dt);
    for (const p of this.poofs) p.t += dt;
    this.poofs = this.poofs.filter((p) => p.t < this.POOF_TIME);
    stepP(this.parts, dt);

    for (const k of this.kunais) {
      k.age += dt;
      if (k.state === 'flying') {
        this._fly(k, dt, env);
        // Motion trail: remember recent positions while flying.
        const tr = k.tr || (k.tr = []);
        tr.push(k.x, k.y);
        if (tr.length > 20) tr.splice(0, 2);
      }
      else if (k.state === 'stuck' && k.target) {
        if (k.target.alive) {
          // Ride along with the enemy.
          k.x = k.target.x + k.ox;
          k.y = k.target.y + k.oy;
        } else {
          k.target = null;
          k.state = 'dropped';
        }
      }
    }

    if (env.pressed && env.active && this.cd <= 0) {
      if (this.kunais.length >= this.MAX_KUNAI) this.removeKunai(this.kunais[0]);
      const f = o.facing, len = Math.hypot(f.x, f.y) || 1;
      const dx = f.x / len, dy = f.y / len;
      this.kunais.push({
        x: o.x + dx * o.radius, y: o.y + dy * o.radius,
        vx: dx * this.SPEED, vy: dy * this.SPEED,
        state: 'flying', dist: 0, age: 0, target: null, ox: 0, oy: 0, tr: [],
      });
      this.cd = this.COOLDOWN;
      // Throw whoosh lines at the owner.
      for (let i = 0; i < 5; i++) {
        const sp = (Math.random() - 0.5) * 0.7;
        const c = Math.cos(sp), s = Math.sin(sp);
        const vx = (dx * c - dy * s) * (260 + Math.random() * 200), vy = (dx * s + dy * c) * (260 + Math.random() * 200);
        addP(this.parts, o.x + dx * o.radius, o.y + dy * o.radius, vx, vy, 0.18, 1.5, '#e8f0f8', 1, 3);
      }
    }
  }

  // Advance a flying kunai in small steps so it can't tunnel through walls.
  _fly(k, dt, env) {
    const total = this.SPEED * dt;
    const steps = Math.max(1, Math.ceil(total / 4));
    const step = total / steps;
    const ux = k.vx / this.SPEED, uy = k.vy / this.SPEED;
    const opp = env.opponent;
    for (let i = 0; i < steps; i++) {
      const nx = k.x + ux * step, ny = k.y + uy * step;
      if (Game.Arena.circleHitsWall(nx, ny, 3)) {
        k.state = 'stuck';
        // Back off so the center sits just outside the wall.
        let n = 0;
        while (Game.Arena.circleHitsWall(k.x, k.y, 3) && n++ < 20) { k.x -= ux; k.y -= uy; }
        // Wall-stick sparks + tiny dust.
        for (let j = 0; j < 7; j++) {
          const a = Math.atan2(-uy, -ux) + (Math.random() - 0.5) * 2.2, sp = 80 + Math.random() * 200;
          addP(this.parts, k.x, k.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.25, 2, j % 2 ? '#ffe9a8' : '#ffffff', 1, 5);
        }
        burst(this.parts, k.x, k.y, 4, 15, 50, 0.45, 5, 'rgba(190,190,200,0.5)', 2, 3);
        return;
      }
      k.x = nx; k.y = ny; k.dist += step;
      if (opp && opp.alive && Math.hypot(opp.x - k.x, opp.y - k.y) <= opp.radius + 4) {
        opp.takeDamage(this.DAMAGE);
        // Stick into the opponent's edge, on the side we hit from.
        k.state = 'stuck';
        k.target = opp;
        k.ox = -ux * opp.radius;
        k.oy = -uy * opp.radius;
        k.x = opp.x + k.ox; k.y = opp.y + k.oy;
        k.vx = ux * this.SPEED; k.vy = uy * this.SPEED; // angle points inward
        // Impact sparks + shake.
        for (let j = 0; j < 12; j++) {
          const a = Math.atan2(-uy, -ux) + (Math.random() - 0.5) * 2.4, sp = 100 + Math.random() * 280;
          addP(this.parts, k.x, k.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.3, 2, j % 3 ? '#ff6a6a' : '#ffffff', 1, 4);
        }
        Game.FX.shake(3, 0.1);
        return;
      }
      if (k.dist >= this.MAX_DIST) { k.state = 'dropped'; return; }
    }
  }

  draw(ctx) {
    const o = this.owner;
    this.kunais.forEach((k, idx) => {
      const next = idx === 0; // oldest = next teleport target
      ctx.save();
      // Subtle pulsing ground marker under settled kunai.
      if (k.state !== 'flying') {
        const gp = 0.5 + 0.5 * Math.sin(k.age * 5 + idx);
        ctx.globalAlpha = 0.12 + 0.12 * gp;
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.arc(k.x, k.y, 12 + 4 * gp, 0, Math.PI * 2); ctx.fill();
      }
      // Fading motion trail while flying.
      if (k.state === 'flying' && k.tr && k.tr.length > 2) {
        const tr = k.tr, n = tr.length / 2;
        ctx.lineCap = 'round';
        for (let i = 1; i < n; i++) {
          const f = i / n;
          ctx.globalAlpha = f * 0.6;
          ctx.strokeStyle = f > 0.6 ? '#ffffff' : o.color;
          ctx.lineWidth = 1 + f * 4;
          ctx.beginPath(); ctx.moveTo(tr[(i - 1) * 2], tr[(i - 1) * 2 + 1]); ctx.lineTo(tr[i * 2], tr[i * 2 + 1]); ctx.stroke();
        }
      }
      // Dashed line owner -> kunai, brighter for the next target.
      ctx.globalAlpha = next ? 0.6 : 0.25;
      ctx.strokeStyle = o.color;
      ctx.lineWidth = next ? 2 : 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(k.x, k.y); ctx.stroke();
      ctx.setLineDash([]);

      // Kunai: pulsing, rotated to its heading.
      const pulse = 1 + 0.12 * Math.sin(k.age * 18);
      const ang = Math.atan2(k.vy, k.vx);
      ctx.translate(k.x, k.y);
      ctx.rotate(ang);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-18, 0); ctx.stroke();
      // Spin: ring-guard spokes rotating while flying.
      if (k.state === 'flying') {
        ctx.save();
        ctx.rotate(k.age * 30);
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
        ctx.restore();
      }
      // Blade (elongated diamond).
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#d5dde6';
      ctx.strokeStyle = '#8fa0b3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(11, 0); ctx.lineTo(0, -3.5); ctx.lineTo(-7, 0); ctx.lineTo(0, 3.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Glint sweeping along the blade.
      const gl = (k.age * 1.6) % 1.6;
      if (gl < 1) {
        ctx.globalAlpha = Math.sin(gl * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-6 + gl * 15, 0, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      if (next) {
        // Marker ring around the next teleport target.
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(k.x, k.y, 16 + Math.sin(k.age * 6) * 1.5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    });

    // Poofs where kunai were removed.
    for (const p of this.poofs) {
      const t = p.t / this.POOF_TIME;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = '#d5dde6';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 + 14 * t, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.lineCap = 'round';
    drawP(ctx, this.parts);
    ctx.restore();
  }

  hud() {
    return {
      name: 'Kunai',
      key: this.owner.keyLabel('ability1'),
      cooldownFrac: this.cd / this.COOLDOWN,
      charge: null,
      state: this.cd > 0 ? 'cooldown' : 'ready',
      count: this.kunais.length,
    };
  }
};

Game.Abilities.KunaiTeleport = class KunaiTeleport {
  constructor(owner) {
    this.owner = owner;
    this.COOLDOWN = 1.5;
    this.BLINK_TIME = 0.25;
    this.GHOST_TIME = 0.35;
    this._throw = null;
    this.reset();
  }

  reset() {
    this.effects = [];   // blink rings { x, y, t }
    this.ghosts = [];    // afterimages { x, y, t }
    this.parts = [];
    this.cd = 0;
  }

  // Lazily locate the sibling KunaiThrow (ability order isn't guaranteed).
  _thrower() {
    if (!this._throw) {
      const a = (this.owner.abilities || []).find((s) => s.impl instanceof Game.Abilities.KunaiThrow);
      this._throw = a ? a.impl : null;
    }
    return this._throw;
  }

  _blink(x, y) {
    this.effects.push({ x, y, t: 0 });
    burst(this.parts, x, y, 10, 60, 220, 0.3, 2.5, this.owner.color, 1, 4);
  }

  update(dt, env) {
    const o = this.owner;
    if (this.cd > 0) this.cd = Math.max(0, this.cd - dt);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < this.BLINK_TIME);
    for (const g of this.ghosts) g.t += dt;
    this.ghosts = this.ghosts.filter((g) => g.t < this.GHOST_TIME);
    stepP(this.parts, dt);

    const th = this._thrower();
    if (!env.pressed || !env.active || this.cd > 0 || !th || !th.kunais.length) return;

    const k = th.kunais[0]; // oldest
    const sx = o.x, sy = o.y;
    this._blink(o.x, o.y);
    if (k.state === 'stuck' && k.target && k.target.alive) {
      // Land just beside the enemy, on the side the kunai is stuck.
      const t = k.target;
      const len = Math.hypot(k.ox, k.oy) || 1;
      const d = t.radius + o.radius + 2;
      o.x = t.x + (k.ox / len) * d;
      o.y = t.y + (k.oy / len) * d;
    } else {
      o.x = k.x; o.y = k.y;
    }
    th.removeKunai(k);
    Game.Arena.resolveCircle(o);
    this._blink(o.x, o.y);
    this.cd = this.COOLDOWN;
    // Afterimage silhouettes along the path.
    for (let i = 0; i < 7; i++) {
      const f = i / 7;
      this.ghosts.push({ x: sx + (o.x - sx) * f, y: sy + (o.y - sy) * f, t: f * 0.1 });
    }
    Game.FX.flash(o.color, 0.12, 0.08);
  }

  draw(ctx) {
    const o = this.owner;
    ctx.save();
    for (const g of this.ghosts) {
      const p = g.t / this.GHOST_TIME;
      ctx.globalAlpha = (1 - p) * 0.4;
      ctx.fillStyle = o.color;
      ctx.beginPath(); ctx.arc(g.x, g.y, o.radius * (1 - p * 0.3), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (const e of this.effects) {
      const p = e.t / this.BLINK_TIME;
      // Bright core flash.
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(e.x, e.y, 6 + 14 * (1 - p), 0, Math.PI * 2); ctx.fill();
      ring(ctx, e.x, e.y, 8 + 28 * p, 3 * (1 - p) + 1, o.color, 1 - p);
      ring(ctx, e.x, e.y, 4 + 16 * p, 3 * (1 - p) + 1, o.color, 1 - p);
      ring(ctx, e.x, e.y, 6 + 44 * p, 1.5, '#ffffff', (1 - p) * 0.7);
    }
    ctx.lineCap = 'round';
    drawP(ctx, this.parts);
    ctx.restore();
  }

  hud() {
    const th = this._thrower();
    const has = !!(th && th.kunais.length);
    const cooling = this.cd > 0;
    return {
      name: 'Blink',
      key: this.owner.keyLabel('ability3'),
      cooldownFrac: cooling ? this.cd / this.COOLDOWN : (has ? 0 : 1),
      charge: null,
      state: cooling || !has ? 'cooldown' : 'ready',
    };
  }
};
})();
