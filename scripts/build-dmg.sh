#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

ARCH="${1:-}"
VERSION="$(node -p "require('./package.json').version")"

case "$ARCH" in
  x64)
    APP_SUBDIR="mac"
    FINAL_APP_DIR="dist/mac/Codex Menu Meter.app"
    OUTPUT="dist/Codex-Menu-Meter-macOS26-Intel-${VERSION}.dmg"
    ;;
  arm64)
    APP_SUBDIR="mac-arm64"
    FINAL_APP_DIR="dist/mac-arm64/Codex Menu Meter.app"
    OUTPUT="dist/Codex-Menu-Meter-macOS26-AppleSilicon-${VERSION}.dmg"
    ;;
  *)
    echo "usage: $0 x64|arm64" >&2
    exit 2
    ;;
esac

BUILD_OUT="$(mktemp -d /tmp/codex-menu-meter-build-${ARCH}.XXXXXX)"
STAGE="$(mktemp -d /tmp/codex-menu-meter-${ARCH}.XXXXXX)"
TEMP_DMG="$BUILD_OUT/$(basename "$OUTPUT")"
APP_DIR="$BUILD_OUT/$APP_SUBDIR/Codex Menu Meter.app"
cleanup() {
  rm -rf "$BUILD_OUT"
  rm -rf "$STAGE"
}
trap cleanup EXIT

npm run build:native
./node_modules/.bin/electron-builder --mac --dir "--${ARCH}" --config.directories.output="$BUILD_OUT"

# Finder metadata copied from local native artifacts invalidates strict code-sign checks.
xattr -cr "$APP_DIR"
codesign --verify --deep --strict "$APP_DIR"

rm -rf "$FINAL_APP_DIR"
mkdir -p "$(dirname "$FINAL_APP_DIR")"
ditto --norsrc "$APP_DIR" "$FINAL_APP_DIR"
ditto --norsrc "$APP_DIR" "$STAGE/Codex Menu Meter.app"
xattr -cr "$FINAL_APP_DIR" "$STAGE/Codex Menu Meter.app"
# Documents may be managed by a file provider that immediately restores FinderInfo on dist/*.app.
# The clean staging copy is the source of the DMG and is the artifact that must pass strict verify.
codesign --verify --deep --strict "$STAGE/Codex Menu Meter.app"
ln -s /Applications "$STAGE/Applications"
# ULMO（LZMA）比 UDZO(zlib-9) 小 15-25%；需要 macOS 10.15+ 才能挂载，本项目面向新系统没问题。
hdiutil create \
  -volname "Codex Menu Meter" \
  -srcfolder "$STAGE" \
  -ov \
  -format ULMO \
  "$TEMP_DMG"

rm -f "$OUTPUT"
ditto --norsrc "$TEMP_DMG" "$OUTPUT"

rm -f dist/*.blockmap
