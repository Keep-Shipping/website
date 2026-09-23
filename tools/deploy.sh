#!/usr/bin/env bash
# Deploys keepshipping.run (keepshipping.pages.dev until the domain is attached) from origin/main, and from nothing else.
#
#     tools/deploy.sh             build origin/main in a throwaway worktree, deploy it
#     tools/deploy.sh --dry-run   build it and say what would ship, deploy nothing
#
# Why not `build-dist.sh && wrangler pages deploy dist` from wherever you are:
# that ships the contents of a working copy, and a working copy is shared state.
# More than one agent session has worked in the same checkout of this repository
# at once. Deploying from it can publish another session's uncommitted edits, or
# a checkout that is behind main and quietly rolls back work that was merged
# minutes ago. dist/ itself is `rm -rf`'d by every build, so two builds at once
# can hand wrangler a half-assembled directory.
#
# So this never reads the caller's working tree or its dist/. It fetches,
# checks origin/main out into a temporary worktree, builds there, deploys that,
# and removes it. What goes live is always a commit that is on main, and the
# deployment records which one.
#
# Cloudflare credentials: the Factory0 account, via
# CLOUDFLARE_API_TOKEN or `wrangler login` (see README, Deploy).
set -euo pipefail

dry_run=0
case "${1:-}" in
  "") ;;
  --dry-run) dry_run=1 ;;
  *) echo "usage: tools/deploy.sh [--dry-run]" >&2; exit 2 ;;
esac

root=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
cd "$root"

git fetch --quiet origin main
sha=$(git rev-parse origin/main)
subject=$(git log -1 --format=%s "$sha")

tmp=$(mktemp -d "${TMPDIR:-/tmp}/keepshipping-deploy.XXXXXX")
cleanup() {
  git -C "$root" worktree remove --force "$tmp/tree" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

git worktree add --quiet --detach "$tmp/tree" "$sha"
"$tmp/tree/tools/build-dist.sh" >/dev/null

files=$(find "$tmp/tree/dist" -type f | wc -l | tr -d ' ')
echo "origin/main ${sha:0:7}  $subject"
echo "built $files files in a clean checkout"

if [ "$dry_run" = 1 ]; then
  echo "dry run: nothing deployed"
  exit 0
fi

npx --yes wrangler@latest pages deploy "$tmp/tree/dist" \
  --project-name=keepshipping \
  --branch=main \
  --commit-hash="$sha" \
  --commit-message="$subject" \
  --commit-dirty=false

# A deploy that shipped the wrong directory reports the same success as one that
# shipped dist/. Check the live origin for repository files that must never be public.
origin="https://keepshipping.pages.dev"
leaked=0
for p in /README.md /tools/deploy.sh /tools/og-render.html /.git/config /assets/org-avatar.png; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$origin$p")
  if [ "$code" = 200 ]; then echo "LEAK: $origin$p answers 200" >&2; leaked=1; fi
done
[ "$leaked" = 0 ] && echo "leak check: clean"
exit "$leaked"
