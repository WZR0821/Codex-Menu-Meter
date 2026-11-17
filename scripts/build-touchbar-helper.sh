#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p native

HELPER="native/touchbar-helper"
SOURCE="native/touchbar-helper.swift"

if [[ "${CMM_FORCE_NATIVE_REBUILD:-0}" != "1" && -x "$HELPER" && "$HELPER" -nt "$SOURCE" ]]; then
  ARCHS="$(lipo -archs "$HELPER" 2>/dev/null || true)"
  if [[ " $ARCHS " == *" x86_64 "* && " $ARCHS " == *" arm64 "* ]]; then
    echo "using cached $HELPER ($ARCHS)"
    exit 0
  fi
fi

# 命令行工具自带的 Swift 模块描述可能和它的 SDK 对不上（本机 2026-11：usr/include/swift 下
# module.modulemap 与 bridging.modulemap 重复定义 SwiftBridging，AppKit 编不过）。
# 没有显式指定 DEVELOPER_DIR、而默认又指向命令行工具时，改用完整的 Xcode。
if [[ -z "${DEVELOPER_DIR:-}" && "$(xcode-select -p 2>/dev/null)" == *CommandLineTools* ]]; then
  for candidate in "/Applications/Xcode.app" "$HOME/Downloads/Xcode.app"; do
    if [[ -x "$candidate/Contents/Developer/usr/bin/xcodebuild" ]]; then
      export DEVELOPER_DIR="$candidate/Contents/Developer"
      echo "using Xcode toolchain: $DEVELOPER_DIR"
      break
    fi
  done
fi

SLICES=()
for arch in x86_64 arm64; do
  out="/tmp/codex-menu-meter-touchbar-$arch"
  swiftc -O -swift-version 5 -target "$arch-apple-macosx11.0" \
    native/touchbar-helper.swift -o "$out" \
    -framework AppKit \
    -F /System/Library/PrivateFrameworks -framework DFRFoundation
  SLICES+=("$out")
done

lipo -create "${SLICES[@]}" -output "$HELPER"
rm -f "${SLICES[@]}"
chmod +x "$HELPER"

if command -v codesign >/dev/null 2>&1; then
  codesign --force -s - "$HELPER" >/dev/null 2>&1 || true
fi

echo "built $HELPER ($(lipo -archs "$HELPER"))"
