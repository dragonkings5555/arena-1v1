// HUD: health bars, names, round-win pips, and phase overlays.
window.Game = window.Game || {};

Game.HUD = {
  BAR_W: 220,
  BAR_H: 14,
  MARGIN: 24,
  TOP: 28,
  FONT: 'system-ui, sans-serif',
  PORTRAIT: 58,
  PORTRAIT_GAP: 10,

  // Character id -> true if a portrait painter exists (unknown ids get no portrait).
  hasPortrait(p) {
    return !!(p && p.character && Game.Avatars && Game.Avatars.has(p.character.id));
  },

  // Draw one player's panel; side = 0 (left, fills L->R) or 1 (right, fills R->L).
  drawPlayer(ctx, p, side) {
    const C = Game.CONFIG;
    const right = side === 1;
    const portrait = this.hasPortrait(p);
    const inset = portrait ? this.PORTRAIT + this.PORTRAIT_GAP : 0;
    const x = right ? C.WIDTH - this.MARGIN - inset - this.BAR_W : this.MARGIN + inset;
    if (portrait) {
      const px = right ? C.WIDTH - this.MARGIN - this.PORTRAIT : this.MARGIN;
      Game.Avatars.draw(ctx, p.character.id, px, this.TOP - 16, this.PORTRAIT, {
        color: p.color, t: performance.now() / 1000, mirror: right,
      });
      if (!p.alive) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(px, this.TOP - 16, this.PORTRAIT, this.PORTRAIT, this.PORTRAIT * 0.14);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.restore();
      }
    }
    const anchor = right ? x + this.BAR_W : x;

    // Name
    ctx.textAlign = right ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 16px ' + this.FONT;
    ctx.fillStyle = p.color;
    ctx.fillText(p.character ? p.name + ' \u00B7 ' + p.character.name : p.name, anchor, this.TOP);

    // Health bar
    const by = this.TOP + 8;
    const frac = Math.max(0, Math.min(1, p.hp / p.maxHp));
    ctx.fillStyle = 'rgba(20,20,28,0.85)';
    ctx.fillRect(x, by, this.BAR_W, this.BAR_H);
    ctx.fillStyle = p.color;
    const fw = this.BAR_W * frac;
    ctx.fillRect(right ? x + this.BAR_W - fw : x, by, fw, this.BAR_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, by + 0.5, this.BAR_W - 1, this.BAR_H - 1);

    // hp text, centered on the bar with a dark outline for legibility
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px ' + this.FONT;
    const txt = Math.max(0, Math.ceil(p.hp)) + '/' + p.maxHp;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(txt, x + this.BAR_W / 2, by + this.BAR_H / 2 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, x + this.BAR_W / 2, by + this.BAR_H / 2 + 1);

    // Round-win pips below the bar
    const r = 5, gap = 6;
    const py = by + this.BAR_H + 4 + r;
    for (let i = 0; i < C.ROUNDS_TO_WIN; i++) {
      const cx = right ? x + this.BAR_W - r - i * (2 * r + gap) : x + r + i * (2 * r + gap);
      ctx.beginPath();
      ctx.arc(cx, py, r, 0, Math.PI * 2);
      if (p.wins > i) {
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    this.drawAbilities(ctx, p, x, right, py + r + 8);
  },

  // One small icon per ability: key label, cooldown sweep, ready glow, charge bar, tiny name.
  drawAbilities(ctx, p, x, right, top) {
    const abs = p.abilities || [];
    const S = 34, gap = 10;
    abs.forEach((a, i) => {
      const h = a.impl && a.impl.hud ? a.impl.hud() : null;
      if (!h) return;
      const ix = right ? x + this.BAR_W - S - i * (S + gap) : x + i * (S + gap);
      const cx = ix + S / 2;
      ctx.save();
      // Base square
      ctx.beginPath();
      ctx.roundRect(ix, top, S, S, 7);
      ctx.fillStyle = 'rgba(20,20,28,0.85)';
      ctx.fill();
      // Cooldown sweep (clockwise from top), clipped to the square
      ctx.save();
      ctx.clip();
      if (h.state === 'cooldown' && h.cooldownFrac > 0) {
        const cy = top + S / 2, a0 = -Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, S, a0, a0 + Math.PI * 2 * Math.min(1, h.cooldownFrac));
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fill();
      }
      // Charge bar along the bottom
      if (typeof h.charge === 'number') {
        const c = Math.max(0, Math.min(1, h.charge));
        ctx.fillStyle = p.color;
        ctx.fillRect(ix, top + S - 3, S * c, 3);
      }
      ctx.restore();
      // Border (glows when ready/active)
      ctx.beginPath();
      ctx.roundRect(ix, top, S, S, 7);
      const lit = h.state === 'ready' || h.state === 'active';
      if (lit) { ctx.shadowColor = p.color; ctx.shadowBlur = 10; }
      ctx.strokeStyle = lit ? p.color : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = lit ? 2 : 1;
      ctx.stroke();
      ctx.restore();
      // Key label + tiny name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px ' + this.FONT;
      ctx.fillStyle = '#fff';
      ctx.fillText(h.key, cx, top + S / 2 - 1);
      ctx.textBaseline = 'alphabetic';
      ctx.font = '9px ' + this.FONT;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(h.name, cx, top + S + 11);
    });
  },

  draw(ctx, players, state) {
    const C = Game.CONFIG;
    ctx.save();

    if (players[0]) this.drawPlayer(ctx, players[0], 0);
    if (players[1]) this.drawPlayer(ctx, players[1], 1);

    // Center label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 13px ' + this.FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('First to ' + C.ROUNDS_TO_WIN, C.WIDTH / 2, this.TOP);

    const phase = state && state.phase;
    const w = state && state.roundWinner;
    const name = w ? w.name : null;
    const color = w ? w.color : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (phase === 'playing') {
      ctx.font = '12px ' + this.FONT;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(this.hint || 'P1: WASD move \u00B7 Space shoot \u00B7 E Q C F abilities    P2: IJKL move \u00B7 H shoot \u00B7 U O M N abilities', C.WIDTH / 2, C.HEIGHT - 8);
    } else if (phase === 'roundOver') {
      const h = 90, y = C.HEIGHT / 2 - h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, y, C.WIDTH, h);
      ctx.font = 'bold 36px ' + this.FONT;
      ctx.fillStyle = color;
      ctx.fillText(name ? name + ' wins the round!' : 'Draw!', C.WIDTH / 2, C.HEIGHT / 2);
    } else if (phase === 'matchOver') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
      ctx.font = 'bold 56px ' + this.FONT;
      ctx.fillStyle = color;
      ctx.fillText(name ? name + ' wins the match!' : 'Draw!', C.WIDTH / 2, C.HEIGHT / 2 - 20);
      ctx.font = '20px ' + this.FONT;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('Press R to play again', C.WIDTH / 2, C.HEIGHT / 2 + 36);
    }

    ctx.restore();
  },
};
