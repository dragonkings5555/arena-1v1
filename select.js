// Character select screen: both players pick a fighter, lock in, then the match starts.
window.Game = window.Game || {};

Game.Select = {
  FONT: 'system-ui, sans-serif',
  READY_DELAY: 0.5,
  cursors: [0, 0],
  locked: [false, false],
  readyTimer: 0,

  // Both players unlocked, cursors on their current character.
  reset(players) {
    const chars = Game.Characters;
    this.cursors = [0, 1].map((i) => {
      const idx = players && players[i] ? chars.indexOf(players[i].character) : 0;
      return idx >= 0 ? idx : 0;
    });
    this.locked = [false, false];
    this.readyTimer = 0;
  },

  // Returns null, or [defP1, defP2] once both are locked in and the delay has passed.
  update(dt, input, players) {
    const n = Game.Characters.length;
    if (!n) return null;
    const cfg = Game.CONFIG.PLAYERS;
    for (let i = 0; i < 2; i++) {
      const k = (players && players[i] && players[i].keys) || cfg[i].keys;
      if (!this.locked[i]) {
        if (input.wasPressed(k.left) || input.wasPressed(k.up)) this.cursors[i] = (this.cursors[i] + n - 1) % n;
        if (input.wasPressed(k.right) || input.wasPressed(k.down)) this.cursors[i] = (this.cursors[i] + 1) % n;
      }
      if (input.wasPressed(k.fire)) this.locked[i] = !this.locked[i];
    }
    if (this.locked[0] && this.locked[1]) {
      this.readyTimer += dt;
      if (this.readyTimer >= this.READY_DELAY) {
        return [Game.Characters[this.cursors[0]], Game.Characters[this.cursors[1]]];
      }
    } else {
      this.readyTimer = 0;
    }
    return null;
  },

  // 'KunaiTeleport' -> 'Kunai Teleport'
  pretty(name) {
    return String(name || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  },

  // Word-wrap text into lines no wider than maxW.
  wrap(ctx, text, maxW) {
    const lines = [];
    let line = '';
    String(text || '').split(/\s+/).forEach((w) => {
      const t = line ? line + ' ' + w : w;
      if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  },

  draw(ctx, players) {
    const C = Game.CONFIG;
    const chars = Game.Characters;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,16,0.82)';
    ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px ' + this.FONT;
    ctx.fillText('Choose your fighter', C.WIDTH / 2, 70);

    const pw = 400, ph = 380, py = 100;
    const xs = [40, C.WIDTH - 40 - pw];
    for (let i = 0; i < 2; i++) {
      const p = players && players[i];
      const cfg = C.PLAYERS[i];
      const color = (p && p.color) || cfg.color;
      const def = chars[this.cursors[i]];
      this.drawPanel(ctx, xs[i], py, pw, ph, i, p, cfg, color, def, chars.length);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (this.locked[0] && this.locked[1]) {
      ctx.font = 'bold 28px ' + this.FONT;
      ctx.fillStyle = '#ffd54f';
      ctx.fillText('Get ready!', C.WIDTH / 2, 524);
    }
    ctx.font = '14px ' + this.FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(this.hint || 'P1: A/D choose, Space lock in    P2: J/L choose, H lock in', C.WIDTH / 2, 570);
    ctx.restore();
  },

  drawPanel(ctx, x, y, w, h, i, p, cfg, color, def, total) {
    const C = Game.CONFIG;
    const locked = this.locked[i];
    const cx = x + w / 2;

    ctx.fillStyle = 'rgba(20,20,32,0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.globalAlpha = locked ? 1 : 0.45;
    ctx.lineWidth = locked ? 4 : 2;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 1;

    // Player name
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 18px ' + this.FONT;
    ctx.fillStyle = color;
    ctx.fillText((p && p.name) || cfg.name, cx, y + 32);
    if (!def) return;

    // Portrait (top-left), unknown ids leave the slot empty
    const PS = 112, psx = x + 22, psy = y + 46;
    if (Game.Avatars && Game.Avatars.has(def.id)) {
      Game.Avatars.draw(ctx, def.id, psx, psy, PS, { color, t: performance.now() / 1000, mirror: i === 1 });
    }

    // Character name, arrows, index (to the right of the portrait)
    const nx = psx + PS + (x + w - psx - PS) / 2;
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px ' + this.FONT;
    ctx.fillStyle = '#fff';
    ctx.fillText(def.name, nx, psy + 56);
    ctx.font = 'bold 22px ' + this.FONT;
    ctx.fillStyle = color;
    ctx.globalAlpha = locked ? 0.25 : 1;
    ctx.fillText('◀', nx - 70, psy + 92);
    ctx.fillText('▶', nx + 70, psy + 92);
    ctx.globalAlpha = 1;
    ctx.font = '13px ' + this.FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText((this.cursors[i] + 1) + ' / ' + total, nx, psy + 89);

    // Description (wrapped)
    ctx.font = '15px ' + this.FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    let ty = y + 184;
    this.wrap(ctx, def.description, w - 60).forEach((l) => { ctx.fillText(l, cx, ty); ty += 19; });

    // Stats
    const st = def.stats || {};
    ctx.font = 'bold 15px ' + this.FONT;
    ctx.fillStyle = '#fff';
    ctx.fillText('HP ' + (st.maxHp || C.PLAYER_MAX_HP) + '    Speed ' + (st.speed || C.PLAYER_SPEED), cx, y + 248);

    // Abilities
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px ' + this.FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('ABILITIES', x + 30, y + 274);
    const abs = def.abilities || [];
    ctx.font = '15px ' + this.FONT;
    if (!abs.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('None', x + 30, y + 296);
    }
    abs.forEach((a, n) => {
      const key = p && p.keyLabel ? p.keyLabel(a.slot) : (cfg.keyLabels[a.slot] || cfg.keys[a.slot]);
      const ay = y + 296 + n * 22;
      ctx.fillStyle = color;
      ctx.fillText('[' + key + ']', x + 30, ay);
      ctx.fillStyle = '#fff';
      ctx.fillText(this.pretty(a.ability), x + 80, ay);
    });

    if (locked) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px ' + this.FONT;
      ctx.fillStyle = color;
      ctx.fillText('LOCKED IN', cx, y + h - 20);
    }
  },
};
