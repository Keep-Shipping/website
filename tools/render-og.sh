#!/usr/bin/env bash
# Regenerates the raster art from the HTML/SVG sources beside it, with headless
# Chrome (ImageMagick cannot rasterize these correctly):
#   assets/og.png             1200x630  Open Graph / Twitter card   <- tools/og-render.html
#   assets/readme-banner.png  2560x800  README + org profile banner <- tools/banner-render.html
#   assets/org-avatar.png     512x512   GitHub org avatar           <- tools/avatar-render.html
#   assets/logo.png           2400x480  lockup, transparent         <- tools/logo-render.html
#   assets/icon-512.png, assets/apple-touch-icon.png                <- assets/logo-mark.svg
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

shoot() { # src w h out [scale] [extra flag]
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor="${5:-1}" --window-size="$2,$3" ${6:-} \
    --virtual-time-budget=10000 --screenshot="$4" "file://$1" >/dev/null 2>&1
}

shoot "$ROOT/tools/og-render.html" 1200 630 "$ROOT/assets/og.png"
shoot "$ROOT/tools/banner-render.html" 1280 400 "$ROOT/assets/readme-banner.png" 2
shoot "$ROOT/tools/avatar-render.html" 512 512 "$ROOT/assets/org-avatar.png"
shoot "$ROOT/tools/logo-render.html" 1200 240 "$ROOT/assets/logo.png" 2 --default-background-color=00000000

# Icon: Chrome ignores window widths under ~500px, so render at 512 and downscale.
cat > "$TMP/icon.html" <<HTML
<!DOCTYPE html><meta charset="utf-8">
<style>html,body{margin:0;background:#eef0f3;width:512px;height:512px}
svg{display:block;width:512px;height:512px}</style>
$(cat "$ROOT/assets/logo-mark.svg")
HTML
shoot "$TMP/icon.html" 512 512 "$ROOT/assets/icon-512.png"
sips -z 180 180 "$ROOT/assets/icon-512.png" --out "$ROOT/assets/apple-touch-icon.png" >/dev/null

for f in og.png readme-banner.png org-avatar.png logo.png apple-touch-icon.png icon-512.png; do
  printf '%-22s %s\n' "$f" "$(sips -g pixelWidth -g pixelHeight "$ROOT/assets/$f" | tail -2 | awk '{printf "%s ", $2}')"
done
