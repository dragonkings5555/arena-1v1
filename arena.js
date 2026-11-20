// Arena: static walls, drawing, and circle-vs-wall collision.
(function () {
  const C = Game.CONFIG;
  const W = C.WIDTH, H = C.HEIGHT, T = C.WALL_THICKNESS;

  // Outer border: top, bottom, left, right.
  const walls = [
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: T, w: T, h: H - 2 * T },
    { x: W - T, y: T, w: T, h: H - 2 * T },
  ];

  // Interior cover, mirrored left/right. Row y=300 (spawn line) stays open.
  const cover = [
    { x: 450, y: 120, w: 60, h: 100 },  // center top (self-mirrored)
    { x: 450, y: 380, w: 60, h: 100 },  // center bottom (self-mirrored)
    { x: 250, y: 150, w: 40, h: 100 },  // left upper
    { x: 250, y: 350, w: 40, h: 100 },  // left lower
  ];
  for (const b of cover) walls.push(b);
  // Mirror the two left blocks to the right side.
  for (const b of cover.slice(2)) walls.push({ x: W - b.x - b.w, y: b.y, w: b.w, h: b.h });

  // Does circle (x,y,r) overlap rect? Uses closest point on rect.
  function hits(x, y, r, b) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy < r * r;
  }

  Game.Arena = {
    walls,

    draw(ctx) {
      // Floor
      ctx.fillStyle = '#15181f';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 40) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
      for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
      ctx.stroke();

      // Center line and circle
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, T); ctx.lineTo(W / 2, H - T);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2);
      ctx.stroke();

      // Walls: slate fill with light edge
      ctx.fillStyle = '#4a5568';
      ctx.strokeStyle = '#a0aec0';
      ctx.lineWidth = 2;
      for (const b of walls) {
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      }
    },

    // Push entity {x,y,radius} out of every overlapping wall along the shortest axis.
    resolveCircle(e) {
      for (const b of walls) {
        if (!hits(e.x, e.y, e.radius, b)) continue;
        const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
        const dx = e.x - cx, dy = e.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0) {
          // Center outside rect: push along the closest-point normal.
          const d = Math.sqrt(d2), push = e.radius - d;
          e.x += (dx / d) * push;
          e.y += (dy / d) * push;
        } else {
          // Center inside rect: exit via the nearest side, plus radius.
          const l = e.x - b.x, r = b.x + b.w - e.x, t = e.y - b.y, bt = b.y + b.h - e.y;
          const m = Math.min(l, r, t, bt);
          if (m === l) e.x = b.x - e.radius;
          else if (m === r) e.x = b.x + b.w + e.radius;
          else if (m === t) e.y = b.y - e.radius;
          else e.y = b.y + b.h + e.radius;
        }
      }
    },

    circleHitsWall(x, y, r) {
      for (const b of walls) if (hits(x, y, r, b)) return true;
      return false;
    },
  };
})();
