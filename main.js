// Game loop + round logic. Glues Arena, Player, Characters/Abilities, Combat, Select and HUD together.
(function () {
  const C = Game.CONFIG;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = C.WIDTH;
  canvas.height = C.HEIGHT;

  const players = C.PLAYERS.map((def) => new Game.Player(def));
  // phase: 'select' | 'playing' | 'roundOver' | 'matchOver'
  const state = { phase: 'select', roundWinner: null, timer: 0 };

  function startRound() {
    Game.FX.reset();
    players.forEach((p) => p.reset());
    Game.Combat.reset();
    state.phase = 'playing';
    state.roundWinner = null;
    state.timer = 0;
  }

  function startMatch() {
    players.forEach((p) => { p.wins = 0; });
    startRound();
  }

  function openSelect() {
    state.phase = 'select';
    Game.Combat.reset();
    Game.Select.reset(players);
  }

  function updateAbilities(dt) {
    const input = Game.Input;
    players.forEach((p, i) => {
      p.speedMult = 1;
      p.blockFire = false;
      p.untargetable = false;
      p.drawAlpha = 1;
      const env = {
        active: p.alive && p.stunTime <= 0 && state.phase === 'playing',
        opponent: players[1 - i],
        players,
      };
      p.abilities.forEach((a) => {
        const code = p.keys[a.slot];
        env.pressed = input.wasPressed(code);
        env.held = input.isDown(code);
        env.released = input.wasReleased(code);
        a.impl.update(dt, env);
      });
    });
  }

  function update(dt) {
    const input = Game.Input;

    if (state.phase === 'select') {
      // Select.update returns an array of chosen character defs once both players have locked in.
      const picks = Game.Select.update(dt, input, players);
      if (picks) {
        players.forEach((p, i) => p.setCharacter(picks[i]));
        startMatch();
      }
      return;
    }

    if (state.phase === 'matchOver' && input.wasPressed('KeyR')) {
      openSelect();
      return;
    }

    // Players and bullets keep moving during the round-over banner so it doesn't feel frozen.
    updateAbilities(dt);
    players.forEach((p) => p.update(dt, input));
    if (state.phase === 'playing') {
      players.forEach((p) => { if (p.wantsToFire(input)) Game.Combat.fire(p); });
    }
    Game.Combat.update(dt, players);

    if (state.phase === 'playing') {
      const alive = players.filter((p) => p.alive);
      if (alive.length <= 1) {
        const winner = alive[0] || null; // null = both died same frame (draw)
        state.roundWinner = winner;
        if (winner) winner.wins++;
        state.phase = winner && winner.wins >= C.ROUNDS_TO_WIN ? 'matchOver' : 'roundOver';
        state.timer = C.ROUND_END_DELAY;
      }
    } else if (state.phase === 'roundOver') {
      state.timer -= dt;
      if (state.timer <= 0) startRound();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, C.WIDTH, C.HEIGHT);
    Game.Arena.draw(ctx);
    if (state.phase === 'select') {
      Game.Select.draw(ctx, players);
      return;
    }
    ctx.save();
    Game.FX.applyShake(ctx);
    Game.Combat.draw(ctx);
    players.forEach((p) => p.draw(ctx));
    players.forEach((p) => p.abilities.forEach((a) => a.impl.draw(ctx)));
    ctx.restore();
    Game.FX.drawFlash(ctx);
    Game.HUD.draw(ctx, players, state);
  }

  let last = performance.now();
  // One game step. The rAF loop below calls it; net.js also calls it from a worker timer while an online
  // host's tab is hidden (browsers pause rAF in background tabs, which would freeze the match for the guest).
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20); // clamp so tab-switching doesn't teleport things
    last = now;
    const net = Game.Net;
    if (net && net.mode === 'guest') {
      // Online guest: send keys, draw the host's latest snapshot (the host runs the game).
      net.guestTick(dt);
      Game.Input.endFrame();
    } else {
      // During hit-stop gameplay freezes; key presses are kept until it ends.
      if (!Game.FX.tick(dt)) {
        update(dt);
        Game.Input.endFrame();
      }
      if (net && net.mode === 'host') net.hostTick();
    }
    if (!document.hidden) draw();
  }
  function frame(now) {
    tick(now);
    requestAnimationFrame(frame);
  }
  Game.tick = tick;

  // Exposed for debugging / tests.
  Game.state = state;
  Game.openSelect = openSelect; // net.js: back to character select when an online match starts/ends
  Game.players = players;

  openSelect();
  requestAnimationFrame(frame);
})();
