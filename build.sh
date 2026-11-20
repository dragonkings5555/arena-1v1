#!/bin/sh
# Bundles the game into one self-contained HTML file (for publishing as an Artifact).
# Usage: sh build.sh <output.html>
cd "$(dirname "$0")"
OUT="${1:-arena-1v1.bundle.html}"
{
cat <<'HEAD'
<title>Arena 1v1</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  :root { --bg: #0b0e14; --fg: #c9d1e0; --muted: #7d8799; color-scheme: dark; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif;
         display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
         padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
         padding-block: 12px; box-sizing: border-box; }
  canvas { max-width: 100%; max-height: calc(100% - 40px); border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,.6); outline: none; }
  canvas:focus-visible { outline: 2px solid #4fc3f7; }
  p { margin: 0; font-size: 13px; color: var(--muted); text-align: center; }
</style>
<canvas id="game" tabindex="0"></canvas>
<p>Click the game once so it gets your keyboard. Needs a keyboard: two players share one.</p>
HEAD
for f in config.js arena.js player.js combat.js fx.js characters.js abilities/kunai.js abilities/orb.js abilities/mine.js abilities/dash.js abilities/void.js abilities/parry.js sprites/sprites.js sprites/gunner.js sprites/ninja.js sprites/voidwalker.js avatars/avatars.js avatars/gunner.js avatars/ninja.js avatars/voidwalker.js hud.js select.js main.js vendor/peerjs.min.js net.js; do
  printf '<script>\n/* ---- %s ---- */\n' "$f"; cat "$f"; printf '\n</script>\n'
done
printf '<script>document.getElementById("game").focus();document.addEventListener("pointerdown",()=>document.getElementById("game").focus());</script>\n'
} > "$OUT"
echo "wrote $OUT"
