#!/bin/bash
# 冒烟测试（2.0.0）：用隔离的用户数据目录启动打好的应用，等它写出第一份完整状态、确认进程还活着，再关掉。
# 不弹通知、不注册快捷键、不开手机页和云同步、不查更新、不拉价格表；本机和 CI 都能跑：
#   bash scripts/smoke-test.sh "path/to/Codex Menu Meter.app"
set -euo pipefail

APP="${1:?usage: $0 <path/to/Codex Menu Meter.app>}"
BIN="$APP/Contents/MacOS/Codex Menu Meter"
TIMEOUT_SECONDS="${CMM_SMOKE_TIMEOUT:-90}"
[[ -x "$BIN" ]] || { echo "missing executable: $BIN" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/cmm-smoke.XXXXXX")"
PID=""
cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    for _ in 1 2 3 4 5; do kill -0 "$PID" 2>/dev/null || break; sleep 1; done
    kill -9 "$PID" 2>/dev/null || true
  fi
  if [[ "${CMM_SMOKE_KEEP:-0}" == "1" ]]; then echo "kept $WORK"; else rm -rf "$WORK"; fi
}
trap cleanup EXIT

mkdir -p "$WORK/userdata"
cat > "$WORK/userdata/settings.json" <<'JSON'
{"notificationsEnabled":false,"paceAlertsEnabled":false,"creditExpiryAlerts":false,"weeklyResetReminder":false,"hotkeyEnabled":false,"openAtLogin":false,"autoSwitchProvider":false,"mobileEnabled":false,"cloudSyncEnabled":false,"updateCheckEnabled":false,"priceAutoUpdate":false}
JSON

CMM_USER_DATA_DIR="$WORK/userdata" CMM_DISABLE_TOUCHBAR=1 CMM_DEBUG_STATE_PATH="$WORK/state.json" \
  "$BIN" >"$WORK/app.log" 2>&1 &
PID=$!

check_state() {
  node -e '
    const state = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const slice = state.tokenActivity || {};
    const activity = slice.data;
    // days 只含有用量的日子，CI 机器上没有日志时是空数组；这里只要求首轮读取成功、历史回填走完。
    const ok = state.provider
      && slice.status === "ok"
      && activity && Array.isArray(activity.days)
      && activity.history && activity.history.status === "ready";
    process.exit(ok ? 0 : 1);
  ' "$WORK/state.json" 2>/dev/null
}

for ((second = 1; second <= TIMEOUT_SECONDS; second += 1)); do
  sleep 1
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "app exited before writing its state" >&2
    cat "$WORK/app.log" >&2 || true
    exit 1
  fi
  if [[ -s "$WORK/state.json" ]] && check_state; then
    # 再多跑几秒，确认首轮刷新之后也没有崩
    sleep 3
    kill -0 "$PID" 2>/dev/null || { echo "app exited after its first state" >&2; cat "$WORK/app.log" >&2 || true; exit 1; }
    echo "smoke test passed after ${second}s"
    exit 0
  fi
done

echo "timed out after ${TIMEOUT_SECONDS}s waiting for a complete state" >&2
cat "$WORK/app.log" >&2 || true
exit 1
