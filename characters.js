// Character registry + ability contract.
// A character = stats + up to two abilities. Each ability is a class in Game.Abilities.
window.Game = window.Game || {};
Game.Abilities = Game.Abilities || {};
Game.Characters = [];

Game.registerCharacter = function (def) {
  Game.Characters.push(def);
  return def;
};

/*
 CHARACTER DEF
   {
     id: 'ninja', name: 'Ninja', description: 'one line for the select screen',
     stats: { maxHp: 100, speed: 240 },      // optional, defaults from CONFIG
     abilities: [                            // 0-4 entries, slot = 'ability1'..'ability4'
       { slot: 'ability1', ability: 'KunaiTeleport' },   // name of a class in Game.Abilities
       { slot: 'ability2', ability: 'EnergyOrb' },
     ],
   }
 Key per slot comes from the player's CONFIG keys (P1: E C Q F, P2: . / ; ').

 ABILITY CLASS CONTRACT  (Game.Abilities.<Name> = class { ... })
   constructor(owner)          owner = Game.Player
   reset()                     called at every round start: clear projectiles/effects, cooldown = 0
   update(dt, env)             called every frame BEFORE the owner moves. env = {
                                 pressed:  bool  key went down this frame
                                 held:     bool  key is currently down
                                 released: bool  key went up this frame
                                 active:   bool  owner alive AND round is 'playing' (if false: don't start
                                                 anything new, but let in-flight effects finish/fade)
                                 opponent: Game.Player
                                 players:  Game.Player[]
                               }
                               Abilities may lower owner.speedMult (starts at 1 each frame) and set
                               owner.blockFire = true (reset to false each frame). Deal damage with
                               opponent.takeDamage(n) only if opponent.alive.
                               Stun with opponent.stun(seconds) (stunned players can't move/shoot; their env.active is false).
                               owner.untargetable = true (reset each frame): takeDamage/stun do nothing, bullets pass through.
                               owner.drawAlpha (reset to 1 each frame): opacity the owner's body is drawn with.
                               Abilities can move the owner directly (set owner.x/y, then Game.Arena.resolveCircle(owner));
                               set owner.speedMult = 0 to suppress normal walking during it.
                               Parry hooks: owner.parryActive (the ability keeps it true during its window, false otherwise,
                               and false in reset()) and owner.onParried = (info) => {...} (assign in the constructor).
                               While parryActive, takeDamage(n) and stun() on the owner are cancelled and onParried({kind:'hit', damage})
                               is called instead; bullets are reflected by combat.js and call onParried({kind:'bullet', x, y}).
                               Game feel: Game.FX.shake(px, seconds), Game.FX.hitStop(seconds), Game.FX.flash(color, alpha, seconds).
                               Abilities of the same owner can find each other via owner.abilities[i].impl.
   draw(ctx)                   world effects, drawn after players
   hud() -> { name, key, cooldownFrac, charge, state }
                               name: short ability name, key: display key (use this.owner.keyLabel(slot)),
                               cooldownFrac: 0 = ready, 1 = just went on cooldown,
                               charge: 0..1 or null (e.g. orb energy remaining),
                               state: 'ready' | 'active' | 'cooldown'
 Useful helpers: Game.Arena.circleHitsWall(x,y,r), Game.Arena.resolveCircle(entity), Game.CONFIG.
*/

// Plain shooter with no abilities, the original base character.
Game.registerCharacter({
  id: 'gunner',
  name: 'Gunner',
  description: 'No tricks, just a gun.',
  stats: {},
  abilities: [],
});

Game.registerCharacter({
  id: 'ninja',
  name: 'Ninja',
  description: 'Throw kunai and blink to them, ride an exploding energy orb, and hide stun mines.',
  stats: { maxHp: 90, speed: 260 },
  abilities: [
    { slot: 'ability1', ability: 'KunaiThrow' },
    { slot: 'ability3', ability: 'KunaiTeleport' },
    { slot: 'ability2', ability: 'EnergyOrb' },
    { slot: 'ability4', ability: 'LandMine' },
  ],
});

Game.registerCharacter({
  id: 'voidwalker',
  name: 'Voidwalker',
  description: 'Slip into the void to become untouchable, then dash out and strike.',
  stats: { maxHp: 100, speed: 245 },
  abilities: [
    { slot: 'ability1', ability: 'DashStrike' },
    { slot: 'ability2', ability: 'VoidPhase' },
    { slot: 'ability3', ability: 'Parry' },
  ],
});
