// Combat: bullets, hit detection, impact sparks. Attaches to Game.Combat.
(function () {
  const C = Game.CONFIG;

  const Combat = {
    bullets: [],   // {x,y,vx,vy,radius,ownerId,color}
    particles: [], // internal spark effects {x,y,vx,vy,life,maxLife,color}

    reset() {
      this.bullets.length = 0;
      this.particles.length = 0;
    },

    // Spawn a bullet just in front of the player along its facing.
    fire(player) {
      const f = player.facing;
      const off = player.radius + C.BULLET_RADIUS + 2;
      this.bullets.push({
        x: player.x + f.x * off,
        y: player.y + f.y * off,
        vx: f.x * C.BULLET_SPEED,
        vy: f.y * C.BULLET_SPEED,
        radius: C.BULLET_RADIUS,
        ownerId: player.id,
        color: player.color,
      });
      player.cooldown = C.FIRE_COOLDOWN;
    },

    // Small burst of short-lived sparks at an impact point.
    _burst(x, y, color) {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 140;
        const life = 0.2 + Math.random() * 0.2;
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life, maxLife: life, color,
        });
      }
    },

    update(dt, players) {
      const bullets = this.bullets;
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        let hit = false;

        // Off-screen: removed silently (no sparks).
        if (b.x < -b.radius || b.x > C.WIDTH + b.radius ||
            b.y < -b.radius || b.y > C.HEIGHT + b.radius) {
          bullets.splice(i, 1);
          continue;
        }

        if (Game.Arena.circleHitsWall(b.x, b.y, b.radius)) {
          hit = true;
        } else {
          for (const p of players) {
            if (p.id === b.ownerId || p.alive !== true || p.untargetable) continue;
            const dx = p.x - b.x, dy = p.y - b.y;
            const r = p.radius + b.radius;
            if (dx * dx + dy * dy <= r * r) {
              // Parry: bounce the bullet straight back as the parrier's own bullet.
              if (p.parryActive && p.onParried) {
                b.vx = -b.vx; b.vy = -b.vy;
                b.ownerId = p.id; b.color = p.color;
                b.x += b.vx * dt * 2; b.y += b.vy * dt * 2;
                p.onParried({ kind: 'bullet', x: b.x, y: b.y });
                break;
              }
              p.takeDamage(C.BULLET_DAMAGE);
              hit = true;
              break;
            }
          }
        }

        if (hit) {
          this._burst(b.x, b.y, b.color);
          bullets.splice(i, 1);
        }
      }

      // Age and move particles.
      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },

    draw(ctx) {
      ctx.save();
      // Glowing bullets.
      for (const b of this.bullets) {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Fading sparks.
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      ctx.restore(); // restores alpha and shadow state
    },
  };

  Game.Combat = Combat;
})();
