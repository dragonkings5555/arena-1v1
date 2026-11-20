// Shared config + module contract. Every module attaches to window.Game.
// Load order (index.html): config.js, arena.js, player.js, combat.js, hud.js, main.js
window.Game = window.Game || {};

Game.CONFIG = {
  WIDTH: 960,
  HEIGHT: 600,
  WALL_THICKNESS: 20,

  PLAYER_RADIUS: 16,
  PLAYER_SPEED: 240,        // px per second
  PLAYER_MAX_HP: 100,

  BULLET_SPEED: 520,        // px per second
  BULLET_RADIUS: 5,
  BULLET_DAMAGE: 10,
  FIRE_COOLDOWN: 0.35,      // seconds between shots

  ROUNDS_TO_WIN: 3,         // first to 3 round wins takes the match
  ROUND_END_DELAY: 2.0,     // seconds the "Player X wins the round" banner shows

  PLAYERS: [
    { id: 1, name: 'Player 1', color: '#4fc3f7', spawn: { x: 120, y: 300 }, facing: { x: 1, y: 0 },
      keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space', ability1: 'KeyE', ability2: 'KeyC', ability3: 'KeyQ', ability4: 'KeyF' },
      keyLabels: { fire: 'Space', ability1: 'E', ability2: 'C', ability3: 'Q', ability4: 'F' } },
    { id: 2, name: 'Player 2', color: '#ff8a65', spawn: { x: 840, y: 300 }, facing: { x: -1, y: 0 },
      // One-handed cluster around IJKL, mirroring P1's layout: H shoot (next to J), U/O above, N/M below.
      keys: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', fire: 'KeyH', ability1: 'KeyU', ability2: 'KeyM', ability3: 'KeyO', ability4: 'KeyN' },
      keyLabels: { fire: 'H', ability1: 'U', ability2: 'M', ability3: 'O', ability4: 'N' } },
  ],
};

/*
 MODULE CONTRACT (each file implements one piece; main.js glues them):

 arena.js  -> Game.Arena = {
   walls: [{x,y,w,h}, ...],                 // outer border + a few interior cover blocks
   draw(ctx),                                // floor + walls
   resolveCircle(entity)                     // entity has x,y,radius; pushes it out of any wall (mutates x,y)
   circleHitsWall(x, y, r) -> boolean        // used for bullets
 }

 player.js -> Game.Input = { isDown(code) -> bool }   // keyboard tracker (keydown/keyup on window, uses e.code)
              Game.Player = class {
   constructor(def)                          // def = one entry of CONFIG.PLAYERS
   // fields: id, name, color, x, y, radius, hp, maxHp, facing {x,y}, cooldown, alive, wins
   reset()                                   // back to spawn, full hp, alive=true, cooldown=0 (keeps wins)
   update(dt, input)                         // movement from keys (normalize diagonals), update facing when moving,
                                             // calls Game.Arena.resolveCircle(this), ticks cooldown down
   wantsToFire(input) -> bool                // fire key down && cooldown <= 0 && alive
   takeDamage(n)                             // hp -= n, alive=false at <=0
   draw(ctx)                                 // circle body in color + small barrel/line showing facing
 }

 combat.js -> Game.Combat = {
   bullets: [],                              // {x,y,vx,vy,radius,ownerId,color}
   reset(),                                  // clear bullets
   fire(player),                             // spawn bullet in front of player along facing, set player.cooldown = FIRE_COOLDOWN
   update(dt, players),                      // move bullets, remove on wall hit / off-screen,
                                             // on hit of a player with id !== ownerId and alive: takeDamage, remove bullet
   draw(ctx)
 }

 hud.js    -> Game.HUD = {
   draw(ctx, players, state)                 // health bars top-left (P1) / top-right (P2) with names, round-win pips,
                                             // overlay text based on state.phase
 }
   state = { phase: 'playing' | 'roundOver' | 'matchOver', roundWinner: Player|null, timer: number }
   - 'roundOver': banner "<name> wins the round!"
   - 'matchOver': banner "<name> wins the match!" + "Press R to play again"

 main.js   -> game loop, round logic, restart with R (I own this).
*/
