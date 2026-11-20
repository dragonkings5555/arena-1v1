// player.js - keyboard input tracker and the Player class.
window.Game = window.Game || {};

// ---- Input: tracks pressed keys by e.code ----
Game.Input = (function () {
  const down = new Set();
  const pressed = new Set();   // went down since last endFrame()
  const released = new Set();  // went up since last endFrame()
  // Keys whose default browser action (scroll, button activation, quick-find) we suppress.
  const BLOCKED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Slash', 'Period', 'Comma', 'Semicolon', 'Quote']);

  const blockLocal = new Set(); // net.js: keyboard keys to ignore (online host ignores P2's keys)
  const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

  window.addEventListener('keydown', (e) => {
    if (typing(e) || blockLocal.has(e.code)) return;
    if (BLOCKED.has(e.code)) e.preventDefault();
    if (!e.repeat && !down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    if (typing(e) || blockLocal.has(e.code)) return;
    if (BLOCKED.has(e.code)) e.preventDefault();
    down.delete(e.code);
    released.add(e.code);
  });
  // Avoid stuck keys when the window loses focus.
  window.addEventListener('blur', () => { down.forEach((c) => released.add(c)); down.clear(); });

  return {
    isDown: (code) => down.has(code),
    wasPressed: (code) => pressed.has(code),
    wasReleased: (code) => released.has(code),
    endFrame() { pressed.clear(); released.clear(); }, // main.js calls this once per frame
    // net.js / touch controls: press or release a key as if it came from the keyboard.
    setKey(code, isDown) {
      if (isDown) { if (!down.has(code)) pressed.add(code); down.add(code); }
      else if (down.has(code)) { down.delete(code); released.add(code); }
    },
    blockLocal,
  };
})();

// ---- Player ----
Game.Player = class {
  constructor(def) {
    const C = Game.CONFIG;
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.color = def.color;
    this.keys = def.keys;
    this.spawn = def.spawn;
    this.radius = C.PLAYER_RADIUS;
    this.wins = 0;
    this.setCharacter(Game.Characters[0]);
  }

  // Apply a character def (see characters.js): stats + fresh ability instances.
  setCharacter(char) {
    const C = Game.CONFIG;
    const stats = char.stats || {};
    this.character = char;
    this.maxHp = stats.maxHp || C.PLAYER_MAX_HP;
    this.speed = stats.speed || C.PLAYER_SPEED;
    this.onParried = null;     // a parry ability installs this in its constructor
    this.abilities = (char.abilities || []).map((a) => {
      const Cls = Game.Abilities[a.ability];
      if (!Cls) throw new Error('Unknown ability ' + a.ability);
      return { slot: a.slot, impl: new Cls(this) };
    });
    this.reset();
  }

  keyLabel(slot) {
    return (this.def.keyLabels && this.def.keyLabels[slot]) || this.keys[slot];
  }

  // Back to spawn with full health; wins are kept.
  reset() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.hp = this.maxHp;
    this.facing = { x: this.def.facing.x, y: this.def.facing.y };
    this.cooldown = 0;
    this.alive = true;
    this.hitFlash = 0;
    this.stunTime = 0;      // > 0 = can't move, shoot or use abilities
    this.untargetable = false; // abilities may set this each frame: ignores damage/stun, bullets pass through
    this.drawAlpha = 1;        // abilities may lower this each frame (fade/invisibility)
    this.parryActive = false;  // set by a parry ability; while true, onParried(info) replaces damage/stun
    this.speedMult = 1;     // abilities may lower this each frame
    this.blockFire = false; // abilities may set this each frame
    (this.abilities || []).forEach((a) => a.impl.reset());
  }

  update(dt, input) {
    if (!this.alive) return;
    if (this.stunTime > 0) {
      this.stunTime = Math.max(0, this.stunTime - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.cooldown = Math.max(0, this.cooldown - dt);
      return;
    }
    const k = this.keys;
    let dx = (input.isDown(k.right) ? 1 : 0) - (input.isDown(k.left) ? 1 : 0);
    let dy = (input.isDown(k.down) ? 1 : 0) - (input.isDown(k.up) ? 1 : 0);

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy); // normalize so diagonals aren't faster
      dx /= len;
      dy /= len;
      this.facing.x = dx;
      this.facing.y = dy;
      this.x += dx * this.speed * this.speedMult * dt;
      this.y += dy * this.speed * this.speedMult * dt;
    }

    Game.Arena.resolveCircle(this);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  wantsToFire(input) {
    return this.alive && this.stunTime <= 0 && !this.blockFire && this.cooldown <= 0 && input.isDown(this.keys.fire);
  }

  stun(seconds) {
    if (this.parryActive && this.onParried) return; // the damage that came with it already triggered the parry
    if (this.alive && !this.untargetable) this.stunTime = Math.max(this.stunTime, seconds);
  }

  takeDamage(n, info) {
    if (this.untargetable) return;
    if (this.parryActive && this.onParried) { this.onParried(Object.assign({ kind: 'hit', damage: n }, info)); return; }
    this.hp -= n;
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alive ? this.drawAlpha : 0.3; // faded corpse / ability fade

    // Character sprite (sprites/), falls back to the plain circle for characters without one.
    if (this.character && Game.Sprites && Game.Sprites.has(this.character.id)) {
      Game.Sprites.drawPlayer(ctx, this);
      this.drawStun(ctx);
      ctx.restore();
      return;
    }

    // Barrel (drawn first so the body overlaps its base).
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.facing.x * (this.radius + 8), this.y + this.facing.y * (this.radius + 8));
    ctx.stroke();

    // Body: white while hit-flashing, otherwise player color.
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.alive && this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; // darker outline
    ctx.stroke();

    // Player number.
    ctx.fillStyle = '#111';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.id), this.x, this.y + 1);

    this.drawStun(ctx);
    ctx.restore();
  }

  // Stun: little stars circling above the head.
  drawStun(ctx) {
    if (this.alive && this.stunTime > 0) {
      const t = performance.now() / 200;
      ctx.fillStyle = '#ffe066';
      for (let i = 0; i < 3; i++) {
        const a = t + (i * Math.PI * 2) / 3;
        const sx = this.x + Math.cos(a) * 14, sy = this.y - this.radius - 8 + Math.sin(a) * 4;
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
};
