#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCE="native/panel-window.mm"
OUTPUT="native/panel-window.node"
if [[ "${CMM_FORCE_NATIVE_REBUILD:-0}" != "1" && -f "$OUTPUT" && "$OUTPUT" -nt "$SOURCE" ]]; then
  ARCHS="$(lipo -archs "$OUTPUT" 2>/dev/null || true)"
  if [[ " $ARCHS " == *" x86_64 "* && " $ARCHS " == *" arm64 "* ]]; then
    echo "using cached $OUTPUT ($ARCHS)"
    exit 0
  fi
fi

INCLUDE_DIR="$(node -p "require('node-api-headers').include_dir")"
BUILD_DIR="$(mktemp -d /tmp/cmm-panel-build.XXXXXX)"
trap 'rm -rf "$BUILD_DIR"' EXIT
for ARCH in x86_64 arm64; do
  xcrun clang++ -std=c++17 -O2 -fobjc-arc -bundle -undefined dynamic_lookup \
    -arch "$ARCH" -mmacosx-version-min=11.0 -DNAPI_VERSION=8 \
    -I"$INCLUDE_DIR" -framework AppKit "$SOURCE" -o "$BUILD_DIR/$ARCH.node"
done
lipo -create "$BUILD_DIR/x86_64.node" "$BUILD_DIR/arm64.node" -output "$OUTPUT"
codesign --force -s - "$OUTPUT"
echo "built $OUTPUT ($(lipo -archs "$OUTPUT"))"
