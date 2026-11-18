#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=C

VERSION="$(node -p "require('./package.json').version")"
OUTPUT_DIR="${1:-dist}"
PACKAGE_NAME="Codex-Menu-Meter-${VERSION}-Developer-Handoff"
STAGE="$(mktemp -d /tmp/cmm-handoff.XXXXXX)"
PACKAGE_ROOT="$STAGE/$PACKAGE_NAME"

cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

mkdir -p "$PACKAGE_ROOT" "$OUTPUT_DIR"

FILES=(
  ".gitignore"
  "LICENSE"
  "README.md"
  "DEVELOPMENT_MAINTENANCE.md"
  "NEW_SESSION_HANDOFF.md"
  "PACKAGE_MANIFEST.md"
  "RELEASE_CHECKSUMS.txt"
  "cloud/sync-account-core.mjs"
  "cloud/worker.mjs"
  "cloud/wrangler.jsonc"
  "package.json"
  "package-lock.json"
)

DIRECTORIES=(
  "assets"
  "native"
  "scripts"
  "src"
  "test"
)

for file in "${FILES[@]}"; do
  ditto --norsrc "$file" "$PACKAGE_ROOT/$file"
done

for directory in "${DIRECTORIES[@]}"; do
  ditto --norsrc "$directory" "$PACKAGE_ROOT/$directory"
done

find "$PACKAGE_ROOT" -name ".DS_Store" -delete
find "$PACKAGE_ROOT" -type f ! -name "SOURCE_MANIFEST.sha256" -print0 \
  | LC_ALL=C sort -z \
  | xargs -0 shasum -a 256 \
  | sed "s#  $PACKAGE_ROOT/#  #" \
  > "$PACKAGE_ROOT/SOURCE_MANIFEST.sha256"

OUTPUT_PATH="$(cd "$OUTPUT_DIR" && pwd)/$PACKAGE_NAME.zip"
rm -f "$OUTPUT_PATH"
(
  cd "$STAGE"
  /usr/bin/zip -qry -X "$OUTPUT_PATH" "$PACKAGE_NAME"
)

echo "$OUTPUT_PATH"
