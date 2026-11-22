#!/bin/sh
# Build the game and publish it to the gh-pages branch, which GitHub Pages serves.
# Usage: npm run deploy
set -e
cd "$(dirname "$0")/.."

npm test
npm run build

SHA=$(git rev-parse --short HEAD)
REMOTE=$(git remote get-url origin)
NAME=$(git config user.name)
EMAIL=$(git config user.email)
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

cp -R dist/. "$OUT"
touch "$OUT/.nojekyll"   # serve files as they are, without Jekyll processing
cd "$OUT"
git init -q -b gh-pages
git config user.name "$NAME"
git config user.email "$EMAIL"
git add -A
git commit -q -m "Publish $SHA"
git push -q -f "$REMOTE" gh-pages
echo "Published $SHA to gh-pages"
