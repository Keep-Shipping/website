#!/usr/bin/env bash
# Assembles dist/: the exact set of files that should be public.
# An explicit allowlist, so repo tooling can never leak onto the site by accident.
# There is no build step for development: serve the repo root directly
#     python3 -m http.server 8787
#
# Deploy with tools/deploy.sh, which builds origin/main in a clean worktree.
# Do not deploy this script's dist/ directly: it is built from whatever the
# working copy holds, which may not be main.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist

for f in index.html 404.html robots.txt sitemap.xml llms.txt site.webmanifest _headers _redirects; do
  cp "$f" dist/
done
cp -R assets dist/assets
cp -R .well-known dist/.well-known
find dist -name '.DS_Store' -delete

# GitHub-only artwork: not part of the site.
rm -f dist/assets/readme-banner.png dist/assets/org-avatar.png dist/assets/logo.png

# Cache busting. Asset filenames are not content-hashed in the repo, so stamp
# each reference with a short content hash; _headers can then cache /assets/*.css
# and *.js immutably because the URL changes when the file does.
hash_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -c1-8
  else shasum -a 256 "$1" | cut -c1-8; fi
}
for f in keepshipping.css keepshipping.js; do
  h=$(hash_of "dist/assets/$f")
  # `sed -i` is not portable between GNU and BSD: write beside the file and move.
  for page in dist/*.html; do
    sed "s|/assets/$f\"|/assets/$f?v=$h\"|g" "$page" > "$page.stamped" && mv "$page.stamped" "$page"
  done
  # A sed that matches nothing exits 0. Fail instead of shipping an immutable
  # asset under a URL that never changes.
  grep -q "/assets/$f?v=$h\"" dist/index.html || { echo "cache stamp for $f did not apply" >&2; exit 1; }
done

echo "dist/ assembled:"
find dist -type f | sed 's|^dist/|  |' | sort
echo "  ($(find dist -type f | wc -l | tr -d ' ') files)"
