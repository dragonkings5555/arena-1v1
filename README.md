# Arena 1v1

2-player arena fighter: local on one keyboard, or online across two devices. Open `index.html` in a browser (no install, no build).

**Online:** one player clicks "Play online: create room" and shares the 4-letter code (or link); the other types the code and clicks Join. Both use WASD + Space/E/C/Q/F on their own device; phones get an on-screen stick and buttons. The host's browser runs the match and streams snapshots; the guest sends keys (`net.js`, PeerJS WebRTC, vendored in `vendor/`). Online needs a real website (e.g. GitHub Pages); the Artifact viewer blocks WebRTC. Test two tabs without internet with `index.html?net=bc`.

**Character select:** P1 picks with A/D and locks in with Space. P2 picks with J/L and locks in with H.

**In game:**
| | Move | Shoot | Ability 1 | Ability 2 | Ability 3 | Ability 4 |
|---|---|---|---|---|---|---|
| P1 | WASD | Space | E | C | Q | F |
| P2 | IJKL | H | U | M | O | N |

First to 3 round wins takes the match. R goes back to character select.

## Characters
- **Gunner**: no abilities, just the gun.
- **Ninja** (90 HP, fast):
  - **Kunai (E, ability 1):** throw a kunai for 12 dmg. Kunai never expire and stick in walls, or in the enemy (and move with them). Max 2 out; a 3rd throw removes the oldest.
  - **Teleport (Q, ability 3):** blink to your oldest kunai and use it up. If it's stuck in the enemy you land right next to them. 1.5s cooldown.
  - **Energy Orb (hold C, ability 2):** 50% faster while holding (up to 2.5s, no shooting). Explodes on the enemy for 30 dmg + knockback. 5s cooldown.
  - **Land Mine (F, ability 4):** drop a mine that goes invisible after 0.8s. Enemy stepping on it takes 15 dmg and is stunned for 1s. Max 3, 2s cooldown.

- **Voidwalker** (100 HP):
  - **Dash Strike (E, ability 1):** dash 200px forward, 22 dmg + knockback to the enemy you pass through. 3s cooldown.
  - **Void (C, ability 2):** vanish into the void for 3s: nearly invisible, can't be hit or stunned, moves a bit faster, can't shoot. Press again to come out early. 7s cooldown.
  - **Parry (Q, ability 3):** a 0.35s parry window. Any hit is cancelled, bullets bounce back at the shooter, and an attacker within 130px is stunned 1s and knocked back. 1.5s cooldown after a parry, 4s after a miss.

## Files
- `config.js`: tuning numbers + keys
- `characters.js`: character registry + the ability contract (add new characters here)
- `abilities/`: one file per ability (`kunai.js`, `orb.js`)
- `sprites/`: top-down in-arena character drawings (`sprites.js` registry + one painter per character id, used by player.js draw(); unknown ids fall back to the plain circle). `preview.html` shows poses.
- `avatars/`: canvas-drawn character portraits (`avatars.js` registry + one painter per character id; `preview.html` to view them). New characters: add `avatars/<id>.js` and list it in index.html + build.sh before hud.js.
- `arena.js`, `player.js`, `combat.js`, `hud.js`, `select.js`, `main.js`: walls, players/input, bullets, HUD, select screen, game loop
