const { app, BrowserWindow, Tray, ipcMain, nativeImage, nativeTheme, screen, shell, globalShortcut, Notification, clipboard, systemPreferences, net, session, powerMonitor } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { readModelCatalog, mergeCatalogItems, latestFamilyItem, compareModelVersions } = require('./model-catalog');
const { createRadarBenchReader } = require('./radar-bench');
const qrcode = require('qrcode-generator');
const i18n = require('./i18n');
const { parseCodexRolloutLines } = require('./codex-token-activity');
const { parseClaudeTranscriptLines } = require('./claude-token-activity');
const { isCredentialUsable, isRefreshTokenExpired, mergeRefreshedOAuth } = require('./claude-credentials');
const { parseClaudeTimestamp, normalizeClaudeOfficialUsage, resolveClaudePlan } = require('./claude-usage');
const { buildActivityWindows } = require('./activity-windows');
const pace = require('./mobile/usage-pace');
const { normalizeWebhookUrl, buildWebhookRequest } = require('./push-webhook');
const { PRICING_AS_OF, entryCostUsd } = require('./model-pricing');
const { STATUS_PAGES, normalizeStatusSummary } = require('./service-status');
const { ForegroundProviderTracker } = require('./foreground-provider');
const { readTranscriptFile } = require('./transcript-reader');
const {
  createAccessToken,
  createMobilePayload,
  createMobileServer,
  findPreferredLanAddress,
  mobilePayloadSignature
} = require('./mobile-server');
const {
  createCredentials: createCloudSyncCredentials,
  createPairingUrl: createCloudSyncPairingUrl,
  createRecoveryCode: createCloudSyncRecoveryCode,
  deriveMaterial: deriveCloudSyncMaterial,
  encryptPayload: encryptCloudSyncPayload,
  normalizeServerUrl: normalizeCloudSyncServerUrl,
  validateCredentials: validateCloudSyncCredentials
} = require('./mobile/cloud-sync-crypto');
const {
  PROVIDER_BY_ID,
  PROVIDER_IDS,
  OPTIONAL_PROVIDER_IDS,
  USAGE_ONLY_PROVIDER_IDS,
  defaultProviderSettings,
  enabledProviderIds,
  isProviderEnabled,
  normalizeProviderId,
  normalizeProviderSettings
} = require('./provider-config');

const execFileAsync = promisify(execFile);

if (process.env.CMM_USER_DATA_DIR) {
  app.setPath('userData', process.env.CMM_USER_DATA_DIR);
}

const CHATGPT_BASE_URL = 'https://chatgpt.com/backend-api';
const CODEX_USAGE_URL = `${CHATGPT_BASE_URL}/wham/usage`;
const RESET_CREDITS_URL = `${CHATGPT_BASE_URL}/wham/rate-limit-reset-credits`;
const RADAR_URL = 'https://codexradar.com/current.json';
const RADAR_HOME = 'https://codexradar.com/';
const AUTH_PATH = path.join(os.homedir(), '.codex', 'auth.json');
const MODEL_CATALOG_PATH = path.join(os.homedir(), '.codex', 'models_cache.json');
const RADAR_CACHE_PATH = path.join(app.getPath('userData'), 'radar-cache.json');
const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const CLAUDE_PROFILE_URL = 'https://api.anthropic.com/api/oauth/profile';
// 与本机 Claude CLI 的现行刷新地址保持一致，旧 console 域名可能返回网页重定向。
const CLAUDE_OAUTH_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CLAUDE_OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CLAUDE_RADAR_URL = 'https://claudecoderadar.com/data/claude-code-radar.json';
const CLAUDE_RADAR_HOME = 'https://claudecoderadar.com/';
const CLAUDE_CREDS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');
const CLAUDE_KEYCHAIN_SERVICE = 'Claude Code-credentials';
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const CODEX_SESSIONS_DIRS = [
  path.join(os.homedir(), '.codex', 'sessions'),
  path.join(os.homedir(), '.codex', 'archived_sessions')
];
const KIMI_USAGE_BASE = 'https://api.kimi.com/coding/v1';
const GLM_QUOTA_URLS = [
  'https://open.bigmodel.cn/api/monitor/usage/quota/limit',
  'https://api.z.ai/api/monitor/usage/quota/limit'
];
const EXTRA_PROVIDER_IDS = USAGE_ONLY_PROVIDER_IDS;
const EXTRA_PROVIDER_META = Object.fromEntries(EXTRA_PROVIDER_IDS.map((id) => [id, {
  name: PROVIDER_BY_ID[id].label,
  tag: PROVIDER_BY_ID[id].tag,
  envKeys: PROVIDER_BY_ID[id].envKeys || []
}]));
const CLAUDE_ENTRY_CACHE_MS = 30_000;
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const USAGE_HISTORY_PATH = path.join(app.getPath('userData'), 'usage-history.json');
const USAGE_HISTORY_RETENTION_MS = 30 * 24 * 3600_000;
// 最近 24 小时保留原始样本，更早的压成 15 分钟一个。
const USAGE_HISTORY_RAW_MS = 24 * 3600_000;
const USAGE_HISTORY_COMPACT_BUCKET_MS = 15 * 60_000;
const USAGE_HISTORY_VIEW_MS = 24 * 3600_000;
const USAGE_HISTORY_WEEK_VIEW_MS = 7 * 24 * 3600_000;
const USAGE_HISTORY_VIEW_POINTS = 200;
const PANEL_HOTKEY = 'Alt+Command+U';
// 剩余百分比阈值的预设（降序）；'0' 表示只在用尽时提醒。
const ALERT_THRESHOLD_PRESETS = ['20,5', '30,10', '50,20,5', '0'];
// 同一个额度窗口的 resetAt 每次拉取都会小幅抖动（Claude 接口每次的毫秒数不同，GPT 周窗常差 1 秒），
// 判断「是不是同一个窗口」时在这个范围内都算同一个。
const ALERT_SAME_WINDOW_MS = 10 * 60_000;
// standard：5h + 最紧的周限额；full：全部窗口；compact：只有数字；tightest：只显示最紧的一个；icon：只显示图标。
const APPEARANCES = ['light', 'system', 'dark'];
// lan：局域网 + Tailscale（0.0.0.0）；tailscale：只听 Tailscale 地址和本机；local：只听本机。
const MOBILE_LISTEN_SCOPES = ['lan', 'tailscale', 'local'];
const ALERT_STATE_PATH = path.join(app.getPath('userData'), 'alert-state.json');
const WEBHOOK_TIMEOUT_MS = 8_000;
const TOUCHBAR_STATE_PATH = path.join(app.getPath('userData'), 'touchbar-state.json');
const TOUCHBAR_LOG_PATH = path.join(app.getPath('userData'), 'touchbar-helper.log');
const MOBILE_ASSETS_DIR = path.join(__dirname, 'mobile');
const MOBILE_HOST = '0.0.0.0';
const MOBILE_LOOPBACK_HOST = '127.0.0.1';
const MOBILE_PORT = 43821;
const TAILSCALE_DOWNLOAD_URL = 'https://tailscale.com/download/mac';
const DEFAULT_CLOUD_SYNC_SERVER_URL = '';
const CLOUD_SYNC_KEYCHAIN_SERVICE = 'Codex Menu Meter Cloud Sync';
const CLOUD_SYNC_PUSH_DELAY_MS = 1800;
const CLOUD_SYNC_RETRY_MS = 5 * 60_000;
// 内容没变时不重复上传；但至少每隔这么久上传一次，让手机知道 Mac 还在线（同时带上最新的曲线）。
const CLOUD_SYNC_HEARTBEAT_MS = CLOUD_SYNC_RETRY_MS;

const USAGE_REFRESH_MS = 120_000;
const CLAUDE_USAGE_REFRESH_MS = 5 * 60_000;
// 断连期间只读本机凭据（不发请求），发现重新登录后立刻恢复。
const CLAUDE_RECONNECT_POLL_MS = 8_000;
const CLAUDE_RECONNECT_CODES = new Set(['claude-auth-expired', 'claude-no-creds']);
const CLAUDE_LOGIN_COMMAND = 'claude auth login --claudeai';
const EXTRA_USAGE_REFRESH_MS = 5 * 60_000;
// 超过这么久没有成功刷新就标记「数据截至」：约为刷新间隔的 3 倍，偶尔一次失败不打扰。
const STALE_AFTER_MS = {
  usage: 3 * USAGE_REFRESH_MS,
  claudeUsage: 3 * CLAUDE_USAGE_REFRESH_MS,
  kimiUsage: 3 * EXTRA_USAGE_REFRESH_MS,
  glmUsage: 3 * EXTRA_USAGE_REFRESH_MS,
  qwenUsage: 3 * EXTRA_USAGE_REFRESH_MS
};
// 接口回 429 时按 retry-after 退避；没给就至少等这么久，并且不短于该接口的正常刷新间隔。
const RATE_LIMIT_BACKOFF_MS = 10 * 60_000;
const RATE_LIMIT_BACKOFF_MAX_MS = 60 * 60_000;
// 睡眠唤醒或解锁后，网络往往要几秒才恢复；先等一下再刷新，失败的再补一次。
const WAKE_REFRESH_DELAY_MS = 4_000;
const WAKE_RETRY_DELAY_MS = 30_000;
// 窗口到 resetAt 后接口通常要十几秒才切到新窗口。
const RESET_REFRESH_DELAY_MS = 20_000;
const RADAR_REFRESH_MS = 5 * 60_000;
const SERVICE_STATUS_REFRESH_MS = 5 * 60_000;
const MODEL_CATALOG_REFRESH_MS = 60_000;
const TOKEN_ACTIVITY_REFRESH_MS = 5 * 60_000;
const PANEL_FOLLOW_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;
const PANEL_WIDTH = 406;
// 面板高度跟随当前页内容，渲染层量好后通过 panel:content-height 报上来；
// 这两个常量只是首帧的起点和上下限（附加平台没有 Token 区，内容仍比主平台短）。
const PANEL_HEIGHT = 640;
const PANEL_CONTENT_MIN_HEIGHT = 300;
const PANEL_CONTENT_MAX_HEIGHT = 780;
// 切换平台时内容高度会短暂抖动（刷新态和稳定态差十几像素）。变高立刻生效免得内容被裁，
// 变矮则要先稳住一段时间再收，避免一次切换里连着两次 setBounds 压在动画上造成卡顿。
const PANEL_HEIGHT_EPSILON = 6;
const PANEL_HEIGHT_SHRINK_DELAY_MS = 80;
const PANEL_HEIGHT_ANIMATION_MS = 180;
const PANEL_HEIGHT_ANIMATION_FRAME_MS = 16;
const SEND_STATE_COALESCE_MS = 24;
const TRANSCRIPT_PREWARM_DELAY_MS = 5_000;
const PANEL_MIN_WIDTH = 330;
const PANEL_MIN_HEIGHT = 260;
const PANEL_VISIBLE_INSET = 6;
const PANEL_CLOSE_MS = 160;
// macOS 自动隐藏菜单栏在全屏 Space 中会延迟派发同一次点击的 mouse-up/click；
// 合并整次手势，避免一次点击先打开面板、随后又被第二个事件关掉。
const TRAY_EVENT_COALESCE_MS = 1200;
const POINTER_OPEN_GRACE_MS = 350;
const AUTO_HIDE_GRACE_MS = 850;
const MENU_BAR_HOVER_HEIGHT = 44;
const PANEL_HOVER_PADDING = 8;

function idleSlice() {
  return { status: 'idle', data: null, error: null, fetchedAt: null };
}

const state = {
  provider: 'codex',
  language: 'zh-CN',
  enabledProviders: ['codex'],
  usageHistory: Object.fromEntries(PROVIDER_IDS.map((id) => [id, []])),
  usageHistoryWeek: Object.fromEntries(PROVIDER_IDS.map((id) => [id, []])),
  usage: idleSlice(),
  radar: idleSlice(),
  tokenActivity: idleSlice(),
  claudeUsage: idleSlice(),
  claudeRadar: idleSlice(),
  claudeActivity: idleSlice(),
  codexStatus: idleSlice(),
  claudeStatus: idleSlice(),
  kimiUsage: idleSlice(),
  glmUsage: idleSlice(),
  qwenUsage: idleSlice()
};

const defaultSettings = {
  language: 'zh-CN',
  openAtLogin: false,
  autoHideWithMenuBar: true,
  autoSwitchProvider: true,
  notificationsEnabled: true,
  alertThresholds: '20,5',
  paceAlertsEnabled: true,
  webhookUrl: '',
  appearance: 'light',
  hotkeyEnabled: true,
  mobileEnabled: false,
  mobileListenScope: 'lan',
  mobileAccessToken: createAccessToken(),
  cloudSyncEnabled: false,
  cloudSyncServerUrl: process.env.CMM_SYNC_SERVER_URL || DEFAULT_CLOUD_SYNC_SERVER_URL,
  cloudSyncAccountId: '',
  provider: 'codex',
  providerSettings: defaultProviderSettings()
};

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (!panel || panel.isDestroyed()) createPanel();
  // 即使 Electron 仍把另一个 Space 上的窗口视为 visible，也强制在当前 Space 重新呈现。
  showPanelAnimated();
});

let tray = null;
let panel = null;
let settingsWindow = null;
let settings = { ...defaultSettings };
let usageTimer = null;
let claudeUsageTimer = null;
let claudeReconnectTimer = null;
let radarTimer = null;
let serviceStatusTimer = null;
let tokenActivityTimer = null;
let extraUsageTimer = null;
let panelFollowTimer = null;
let lastTrayActivationAt = 0;
let panelShownAt = 0;
let cursorOutsideSince = 0;
let panelAnimationTimer = null;
let panelClosing = false;
let panelBlurTimer = null;
let panelOpenedFromTopEdge = false;
let panelRendererReady = false;
let pendingPanelShow = false;
let panelContentHeight = 0;
let panelHeightShrinkTimer = null;
let panelBoundsAnimationTimer = null;
let panelBoundsAnimationToken = 0;
let panelBoundsTarget = null;
let sendStateTimer = null;
let modelCatalogTimer = null;
let codexModelCatalog = readModelCatalog(null);
let touchBarHelper = null;
let touchBarPresentPending = false;
let touchBarStateTimer = null;
let touchBarHelperOutput = '';
const foregroundProviderTracker = new ForegroundProviderTracker();
let mobileServer = null;
let mobileRuntime = {
  running: false,
  port: null,
  localBaseUrl: null,
  remoteBaseUrl: null,
  tailscaleInstalled: false,
  tailscaleState: 'not-installed',
  error: null
};
let cloudSyncRuntime = {
  status: 'disabled',
  lastSyncedAt: null,
  lastAttemptAt: null,
  error: null
};
let cloudSyncSecretCache = null;
let cloudSyncPushTimer = null;
let cloudSyncRetryTimer = null;
let cloudSyncInFlight = null;
let cloudSyncPushPending = false;
let lastCloudSyncSignature = null;
let lastCloudSyncUploadAt = 0;
const refreshJobs = new Map();
// 被 429 限流的刷新任务：jobKey → 解除时间。期间定时刷新直接跳过，手动刷新也不绕过。
const refreshBackoff = new Map();
let wakeRefreshTimer = null;
let wakeRetryTimer = null;
let resetRefreshTimer = null;

function runRefreshOnce(key, task) {
  if (refreshJobs.has(key)) return refreshJobs.get(key);
  const job = Promise.resolve()
    .then(task)
    .finally(() => refreshJobs.delete(key));
  refreshJobs.set(key, job);
  return job;
}

function refreshStateSlice(jobKey, stateKey, loadData, { formatError, onSettled } = {}) {
  const blockedUntil = refreshBackoff.get(jobKey) || 0;
  if (blockedUntil > Date.now()) return Promise.resolve(state[stateKey]);
  return runRefreshOnce(jobKey, async () => {
    const current = state[stateKey];
    state[stateKey] = {
      ...current,
      status: current.data ? 'refreshing' : 'loading',
      error: null
    };
    sendState();

    try {
      state[stateKey] = {
        status: 'ok',
        data: await loadData(),
        error: null,
        errorCode: null,
        fetchedAt: Date.now(),
        staleAfterMs: STALE_AFTER_MS[stateKey] || null,
        retryAt: null
      };
      refreshBackoff.delete(jobKey);
    } catch (error) {
      const retryAt = error?.status === 429 ? noteRateLimited(jobKey, error) : null;
      state[stateKey] = {
        ...state[stateKey],
        status: 'error',
        error: formatError ? formatError(error) : error.message,
        // 渲染层按错误码决定展示形态（例如 Claude 断连时给出「重新连接」）。
        errorCode: error?.code || (error?.status ? `http-${error.status}` : null),
        staleAfterMs: STALE_AFTER_MS[stateKey] || null,
        retryAt
      };
    }

    onSettled?.();
    sendState();
    return state[stateKey];
  });
}

function noteRateLimited(jobKey, error) {
  const requested = Number(error?.retryAfterMs);
  const delay = Math.min(
    RATE_LIMIT_BACKOFF_MAX_MS,
    Math.max(RATE_LIMIT_BACKOFF_MS, Number.isFinite(requested) ? requested : 0)
  );
  const retryAt = Date.now() + delay;
  refreshBackoff.set(jobKey, retryAt);
  return retryAt;
}

// 唤醒 / 解锁：定时器在睡眠期间不走，醒来后菜单栏还挂着几小时前的数字。
function scheduleWakeRefresh(reason) {
  if (wakeRefreshTimer) clearTimeout(wakeRefreshTimer);
  if (wakeRetryTimer) clearTimeout(wakeRetryTimer);
  wakeRefreshTimer = setTimeout(() => {
    wakeRefreshTimer = null;
    // 唤醒后只有过了 resetAt 的窗口还在显示旧数据，先刷一遍界面再去取新数据。
    updateTrayTitle();
    sendState();
    refreshAll().catch(() => {});
    scheduleResetRefresh();
    wakeRetryTimer = setTimeout(() => {
      wakeRetryTimer = null;
      retryFailedUsageSlices();
    }, WAKE_RETRY_DELAY_MS);
    wakeRetryTimer.unref?.();
  }, WAKE_REFRESH_DELAY_MS);
  wakeRefreshTimer.unref?.();
  logUsageEvent(`wake:${reason}`);
}

function retryFailedUsageSlices() {
  if (state.usage.status === 'error') refreshUsage();
  if (isProviderEnabled('claude', settings.providerSettings) && state.claudeUsage.status === 'error' && !claudeNeedsReconnect()) {
    refreshClaudeUsage();
  }
  for (const id of enabledExtraIds()) {
    if (state[`${id}Usage`].status === 'error') refreshExtraUsage(id);
  }
}

// 在最早的一个 resetAt 之后补一次刷新：及时拿到新窗口、发出「已恢复」提醒，
// 不用等下一轮定时刷新（Claude 是 5 分钟一轮）。
function scheduleResetRefresh() {
  if (resetRefreshTimer) clearTimeout(resetRefreshTimer);
  resetRefreshTimer = null;
  const now = Date.now();
  let earliest = null;
  for (const provider of PROVIDER_IDS) {
    if (!isProviderEnabled(provider, settings.providerSettings)) continue;
    const usage = usageSliceFor(provider)?.data;
    for (const entry of pace.listWindows(usage, { provider, now })) {
      const resetAt = Number(entry.window.resetAt);
      if (!resetAt || resetAt <= now) continue;
      if (!earliest || resetAt < earliest.resetAt) earliest = { provider, resetAt };
    }
  }
  if (!earliest) return;
  const delay = Math.min(earliest.resetAt - now + RESET_REFRESH_DELAY_MS, 24 * 3600_000);
  resetRefreshTimer = setTimeout(() => {
    resetRefreshTimer = null;
    refreshUsageFor(earliest.provider);
  }, delay);
  resetRefreshTimer.unref?.();
}

function usageSliceFor(provider) {
  if (provider === 'codex') return state.usage;
  if (provider === 'claude') return state.claudeUsage;
  return state[`${provider}Usage`] || null;
}

function refreshUsageFor(provider) {
  if (provider === 'codex') return refreshUsage();
  if (provider === 'claude') return refreshClaudeUsage();
  if (EXTRA_PROVIDER_IDS.includes(provider)) return refreshExtraUsage(provider);
  return Promise.resolve(null);
}

function logUsageEvent(message) {
  if (!process.env.CMM_DEBUG_EVENTS) return;
  console.log(`[cmm] ${new Date().toISOString()} ${message}`);
}

function createTray() {
  tray = new Tray(createTransparentTrayImage());
  tray.setTitle('GPT 5h：--  周：--');
  tray.setToolTip('Codex Menu Meter');
  tray.setIgnoreDoubleClickEvents(true);
  tray.on('mouse-down', (event) => handleTrayActivation(event, { pointerDown: true }));
  tray.on('click', handleTrayActivation);
  tray.on('mouse-up', handleTrayActivation);
  tray.on('right-click', openSettingsWindow);
  updateTrayTitle();
}

function createPanel() {
  if (panel && !panel.isDestroyed()) return;
  panelRendererReady = false;
  panel = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    acceptFirstMouse: true,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    movable: true,
    type: 'panel',
    alwaysOnTop: true,
    // 系统原生投影：透明窗口的投影按内容形状缓存，开合与改高度后要手动刷新（见 refreshPanelShadow）。
    hasShadow: true,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  preparePanelForFullScreen();
  panel.loadFile(path.join(__dirname, 'index.html'));
  panel.on('blur', handlePanelBlur);
  panel.on('closed', () => {
    stopPanelBoundsAnimation();
    clearPanelShadowTimers();
    panel = null;
    panelClosing = false;
    panelRendererReady = false;
    pendingPanelShow = false;
  });
}

function preparePanelForFullScreen({ presenting = false } = {}) {
  if (!panel || panel.isDestroyed()) return;
  panel.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  });
  // 全屏应用上方需要 screen-saver 层级才稳定；只在面板显示期间使用，隐藏后立即降回
  // pop-up-menu，避免隐藏窗口长期处于高层级而影响系统自动息屏。
  const level = process.platform === 'darwin' && presenting ? 'screen-saver' : 'pop-up-menu';
  panel.setAlwaysOnTop(true, level, 1);
}

function handleTrayActivation(event, { pointerDown = false } = {}) {
  if (event?.button === 2 || event?.button === 'right') return;
  const now = Date.now();
  // 新的一次按下立即响应，只合并同一次手势尾随的 mouse-up/click。
  if (!pointerDown && now - lastTrayActivationAt < TRAY_EVENT_COALESCE_MS) return;
  lastTrayActivationAt = now;
  togglePanel();
}

function togglePanel() {
  if (!panel) createPanel();
  // 全局鼠标监听可能比托盘事件先到，先启动了关闭动画；托盘点击应撤销关闭并打开。
  if (panelClosing) {
    showPanelAnimated();
    return;
  }
  if (panel.isVisible()) {
    // 面板可能“看似可见”但遗留在别的显示器/全屏空间上——
    // 这时点击托盘应该把它拉到当前托盘处重新显示，而不是关掉（表现为“点了没反应”）。
    const trayBounds = tray?.getBounds();
    const anchor = trayBounds && (trayBounds.width || trayBounds.height)
      ? { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y + trayBounds.height / 2 }
      : screen.getCursorScreenPoint();
    const trayDisplay = screen.getDisplayNearestPoint(anchor);
    const bounds = panel.getBounds();
    const panelDisplay = screen.getDisplayNearestPoint({
      x: bounds.x + Math.round(bounds.width / 2),
      y: bounds.y + Math.round(bounds.height / 2)
    });
    if (panelDisplay.id !== trayDisplay.id) {
      showPanelAnimated();
      return;
    }
    hidePanelAnimated();
    return;
  }

  showPanelAnimated();
}

// 透明窗口的原生投影是按「当时的内容形状」缓存的：渲染层淡入期间多刷几次，
// 投影就跟着内容一起浮现，而不是停在第一帧（几乎透明）的样子。
const PANEL_SHADOW_REFRESH_DELAYS_MS = [70, 140, 230];
let panelShadowTimers = [];

function clearPanelShadowTimers() {
  panelShadowTimers.forEach((timer) => clearTimeout(timer));
  panelShadowTimers = [];
}

function refreshPanelShadow() {
  if (process.platform !== 'darwin' || !panel || panel.isDestroyed() || !panel.isVisible() || panelClosing) return;
  panel.invalidateShadow();
}

function presentPanelShadow() {
  if (process.platform !== 'darwin' || !panel || panel.isDestroyed()) return;
  clearPanelShadowTimers();
  panel.setHasShadow(true);
  panelShadowTimers = PANEL_SHADOW_REFRESH_DELAYS_MS.map((delay) => setTimeout(refreshPanelShadow, delay));
}

function dismissPanelShadow() {
  clearPanelShadowTimers();
  // 关闭时内容在渲染层淡出，投影不会跟着变淡，先撤掉避免留下一圈残影。
  if (process.platform === 'darwin' && panel && !panel.isDestroyed()) panel.setHasShadow(false);
}

function showPanelAnimated() {
  if (!panel || panel.isDestroyed()) return;
  if (!panelRendererReady) {
    pendingPanelShow = true;
    return;
  }
  pendingPanelShow = false;
  clearPanelBlurTimer();
  const targetBounds = positionPanel();
  if (!targetBounds) return;
  stopPanelAnimation();
  panelClosing = false;
  preparePanelForFullScreen({ presenting: true });
  panel.setOpacity(0);
  panel.setBounds(targetBounds);
  panelShownAt = Date.now();
  cursorOutsideSince = 0;
  panelOpenedFromTopEdge = isCursorInTopMenuArea();
  // 不要调用 app.focus()：强制激活会让 macOS 从别的应用的全屏空间切回本应用所在的桌面空间，
  // 表现为「一点开面板就回主屏幕」（0.11.1 修复）。
  // 但不激活本应用时，show() 走的是 makeKeyAndOrderFront，macOS 不保证把非活跃应用的窗口
  // 排到最前——别的应用全屏时面板会落在后面看不见（1.0.0 修复）。所以先用 showInactive()
  // （orderFrontRegardless：不管本应用是否活跃都排到本层级最前），再 focus() 让面板成为
  // 键盘窗口；type: 'panel' 的 focus() 不激活应用，不会切换空间。
  panel.showInactive();
  presentPanelShadow();
  panel.focus();
  requestTouchBarPresentation();
  panel.webContents.send('panel:motion', 'opening');
  startPanelFollowMonitor();
  panel.moveTop();
  // 全屏空间下 show 后窗口层级偶尔晚一拍生效，保留一次轻量兜底即可。
  setTimeout(() => {
    if (!panel || panel.isDestroyed() || !panel.isVisible() || panelClosing) return;
    preparePanelForFullScreen({ presenting: true });
    panel.showInactive();
    panel.moveTop();
  }, 120);
  // Let the renderer own the visual transition. Native opacity is only used to
  // avoid a fully rendered frame before the opening IPC reaches the page.
  panelAnimationTimer = setTimeout(() => {
    panelAnimationTimer = null;
    if (panel && !panel.isDestroyed() && panel.isVisible()) panel.setOpacity(1);
  }, 16);
}

function hidePanelAnimated() {
  if (!panel || !panel.isVisible() || panelClosing) return;
  clearPanelBlurTimer();
  clearPanelHeightShrinkTimer();
  stopPanelBoundsAnimation();
  panelOpenedFromTopEdge = false;
  panel.webContents.send('panel:motion', 'closing');
  stopPanelFollowMonitor();
  stopPanelAnimation();
  dismissPanelShadow();
  panelClosing = true;
  panel.setOpacity(1);
  panelAnimationTimer = setTimeout(() => {
    panelAnimationTimer = null;
    if (!panel || panel.isDestroyed()) return;
    panel.hide();
    panel.setOpacity(1);
    preparePanelForFullScreen();
    panelClosing = false;
  }, PANEL_CLOSE_MS);
}

function stopPanelAnimation() {
  if (!panelAnimationTimer) return;
  clearTimeout(panelAnimationTimer);
  panelAnimationTimer = null;
}

function handlePanelBlur() {
  clearPanelBlurTimer();
  // 刚打开的一小段时间内，前台（尤其是全屏）应用可能把键盘焦点抢回去，面板随即失焦；
  // 这不是用户点到了别处，不能马上收起——否则表现为「面板闪一下就没了」。
  // 真正点到别处由全局点击监听（handleGlobalPointerDown）负责。
  if (Date.now() - panelShownAt < POINTER_OPEN_GRACE_MS) return;
  panelBlurTimer = setTimeout(() => {
    panelBlurTimer = null;
    if (!panel || panel.isDestroyed() || !panel.isVisible()) return;
    const cursor = screen.getCursorScreenPoint();
    if (isPointInsideBounds(cursor, panel.getBounds(), PANEL_HOVER_PADDING)) return;
    if (panelOpenedFromTopEdge && isCursorInTopMenuArea()) return;
    hidePanelAnimated();
  }, 90);
}

function clearPanelBlurTimer() {
  if (!panelBlurTimer) return;
  clearTimeout(panelBlurTimer);
  panelBlurTimer = null;
}

function startPanelFollowMonitor() {
  stopPanelFollowMonitor();
  panelFollowTimer = setInterval(syncPanelWithMenuBar, PANEL_FOLLOW_MS);
}

function stopPanelFollowMonitor() {
  if (!panelFollowTimer) return;
  clearInterval(panelFollowTimer);
  panelFollowTimer = null;
}

// 不再限定“从菜单栏顶部打开”才自动收起：只要光标离开面板和菜单栏区域
// 并持续一小段时间，就收起面板（受“跟随菜单栏收起”开关控制）。
function syncPanelWithMenuBar() {
  if (!panel || !panel.isVisible()) return;
  if (!settings.autoHideWithMenuBar) return;
  if (Date.now() - panelShownAt < AUTO_HIDE_GRACE_MS) {
    cursorOutsideSince = 0;
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const cursorInsidePanel = isPointInsideBounds(cursor, panel.getBounds(), PANEL_HOVER_PADDING);
  const cursorInMenuBar = cursor.y <= display.bounds.y + MENU_BAR_HOVER_HEIGHT;
  if (cursorInsidePanel || cursorInMenuBar) {
    cursorOutsideSince = 0;
    return;
  }
  if (!cursorOutsideSince) {
    cursorOutsideSince = Date.now();
    return;
  }
  if (Date.now() - cursorOutsideSince >= 700) {
    cursorOutsideSince = 0;
    hidePanelAnimated();
  }
}

function isCursorInTopMenuArea() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  return cursor.y <= display.bounds.y + MENU_BAR_HOVER_HEIGHT;
}

function desiredPanelHeight() {
  const requested = Number(panelContentHeight) > 0 ? Number(panelContentHeight) : PANEL_HEIGHT;
  return clamp(Math.round(requested), PANEL_CONTENT_MIN_HEIGHT, PANEL_CONTENT_MAX_HEIGHT);
}

function clearPanelHeightShrinkTimer() {
  if (!panelHeightShrinkTimer) return;
  clearTimeout(panelHeightShrinkTimer);
  panelHeightShrinkTimer = null;
}

function stopPanelBoundsAnimation() {
  panelBoundsAnimationToken += 1;
  panelBoundsTarget = null;
  if (!panelBoundsAnimationTimer) return;
  clearTimeout(panelBoundsAnimationTimer);
  panelBoundsAnimationTimer = null;
}

function animatePanelBounds(targetBounds) {
  if (!panel || panel.isDestroyed() || !panel.isVisible()) return;
  const sameBounds = (left, right) => left && right && ['x', 'y', 'width', 'height'].every((key) => left[key] === right[key]);
  if (sameBounds(panelBoundsTarget, targetBounds)) return;
  const fromBounds = panel.getBounds();
  const heightDelta = Math.abs(targetBounds.height - fromBounds.height);
  const widthDelta = Math.abs(targetBounds.width - fromBounds.width);
  const positionDelta = Math.abs(targetBounds.x - fromBounds.x) + Math.abs(targetBounds.y - fromBounds.y);
  if (heightDelta <= 1 && widthDelta <= 1 && positionDelta <= 1) return;

  stopPanelBoundsAnimation();
  if (systemPreferences.getAnimationSettings().prefersReducedMotion) {
    panel.setBounds(targetBounds);
    refreshPanelShadow();
    return;
  }
  panelBoundsTarget = { ...targetBounds };
  const animationToken = panelBoundsAnimationToken;
  const startedAt = performance.now();
  const duration = Math.min(260, Math.max(PANEL_HEIGHT_ANIMATION_MS, Math.round(heightDelta * 0.5)));
  let lastBounds = fromBounds;

  const tick = () => {
    if (animationToken !== panelBoundsAnimationToken || !panel || panel.isDestroyed() || !panel.isVisible()) {
      panelBoundsAnimationTimer = null;
      return;
    }
    const progress = Math.min(1, (performance.now() - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const nextBounds = {
      x: Math.round(fromBounds.x + (targetBounds.x - fromBounds.x) * eased),
      y: Math.round(fromBounds.y + (targetBounds.y - fromBounds.y) * eased),
      width: targetBounds.width,
      height: Math.round(fromBounds.height + (targetBounds.height - fromBounds.height) * eased)
    };
    if (!sameBounds(lastBounds, nextBounds)) panel.setBounds(nextBounds);
    lastBounds = nextBounds;
    if (progress >= 1) {
      panelBoundsAnimationTimer = null;
      panelBoundsTarget = null;
      refreshPanelShadow();
      return;
    }
    panelBoundsAnimationTimer = setTimeout(tick, PANEL_HEIGHT_ANIMATION_FRAME_MS);
  };

  tick();
}

function applyPanelContentHeight() {
  if (!panel || panel.isDestroyed() || !panel.isVisible()) return;
  const current = panel.getBounds();
  const positioned = positionPanel();
  if (!positioned) return;
  // 内容高度变化时只调整高度，保持面板顶部锚点不动；否则 Codex/Claude
  // 内容高度不同，positionPanel 会按底部边界重新计算 y，造成整窗轻微位移。
  const bounds = { ...positioned, x: current.x, y: current.y };
  if (bounds.height === current.height && bounds.x === current.x && bounds.y === current.y) {
    stopPanelBoundsAnimation();
    return;
  }
  animatePanelBounds(bounds);
}

function positionPanel() {
  if (!tray || !panel) return null;
  const trayBounds = tray.getBounds();
  const trayHasBounds = Boolean(trayBounds.width || trayBounds.height);
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(trayHasBounds
    ? {
        x: trayBounds.x + trayBounds.width / 2,
        y: trayBounds.y + trayBounds.height / 2
      }
    : cursor);
  const workArea = display.workArea;
  const width = Math.min(PANEL_WIDTH, Math.max(PANEL_MIN_WIDTH, workArea.width - 16));
  const height = Math.min(desiredPanelHeight(), Math.max(PANEL_MIN_HEIGHT, workArea.height - 24));
  const anchorX = trayHasBounds ? trayBounds.x + trayBounds.width / 2 : cursor.x;
  const anchorY = trayHasBounds ? trayBounds.y + trayBounds.height : display.bounds.y + MENU_BAR_HOVER_HEIGHT;
  const x = clamp(
    Math.round(anchorX - width / 2),
    workArea.x + 8,
    workArea.x + workArea.width - width - 8
  );
  const targetVisibleY = trayHasBounds ? anchorY + 1 : anchorY;
  const y = clamp(
    Math.round(targetVisibleY - PANEL_VISIBLE_INSET),
    display.bounds.y,
    workArea.y + workArea.height - height - 8
  );
  return { x, y, width, height };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function isPointInsideBounds(point, bounds, padding = 0) {
  if (!bounds || (!bounds.width && !bounds.height)) return false;
  return point.x >= bounds.x - padding
    && point.x <= bounds.x + bounds.width + padding
    && point.y >= bounds.y - padding
    && point.y <= bounds.y + bounds.height + padding;
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 390,
    height: 520,
    acceptFirstMouse: true,
    show: false,
    frame: true,
    resizable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    title: tr('settingsTitle'),
    backgroundColor: '#f2f2f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true
    }
  });

  // 普通窗口在别的应用全屏时只能放在桌面空间，show() 激活本应用会把屏幕切回桌面。
  // 允许它进入全屏空间、并在当前空间打开（打开期间切换空间时会跟着走）。
  settingsWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function openSettingsWindow() {
  if (panel?.isVisible()) hidePanelAnimated();
  if (!settingsWindow || settingsWindow.isDestroyed()) createSettingsWindow();

  const reveal = () => {
    if (!settingsWindow || settingsWindow.isDestroyed()) return;
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    settingsWindow.moveTop();
    sendSettings();
  };

  if (settingsWindow.webContents.isLoading()) {
    settingsWindow.webContents.once('did-finish-load', reveal);
    return;
  }

  reveal();
}

function tr(key, params) {
  return i18n.t(settings.language, key, params);
}

function syncStateWithSettings() {
  state.provider = settings.provider;
  state.language = settings.language;
  state.enabledProviders = enabledProviderIds(settings.providerSettings);
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    settings = normalizeSettings(parsed);
    // 旧版本写出的设置文件是 644，启动时顺手收紧。
    fs.chmod(SETTINGS_PATH, 0o600).catch(() => {});
  } catch {
    settings = normalizeSettings(defaultSettings);
  }
  syncStateWithSettings();
}

function alertThresholdList() {
  return String(settings.alertThresholds || defaultSettings.alertThresholds)
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0 && value < 100)
    .sort((a, b) => b - a);
}

function applyAppearance() {
  nativeTheme.themeSource = settings.appearance || 'light';
}

async function saveSettings(nextSettings) {
  const previous = settings;
  settings = normalizeSettings({ ...settings, ...nextSettings });
  syncStateWithSettings();
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  // 设置里有手机访问密钥和第三方 API Key，只给当前用户读写。
  await fs.writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(SETTINGS_PATH, 0o600).catch(() => {});
  if (previous.appearance !== settings.appearance) applyAppearance();
  if (previous.openAtLogin !== settings.openAtLogin) applySystemSettings();
  if (previous.hotkeyEnabled !== settings.hotkeyEnabled) applyPanelHotkey();
  if (previous.mobileEnabled !== settings.mobileEnabled || previous.mobileListenScope !== settings.mobileListenScope) {
    await syncMobileServer({ restart: previous.mobileListenScope !== settings.mobileListenScope });
  }
  if (previous.mobileAccessToken !== settings.mobileAccessToken) mobileServer?.disconnectClients();
  const cloudSyncChanged = previous.cloudSyncEnabled !== settings.cloudSyncEnabled
    || previous.cloudSyncServerUrl !== settings.cloudSyncServerUrl
    || previous.cloudSyncAccountId !== settings.cloudSyncAccountId;
  if (cloudSyncChanged) {
    if (settings.cloudSyncEnabled) queueCloudSyncPush(0);
    else disableCloudSyncRuntime();
  }
  // 刚打开云同步时，桌面没选中的平台还没采过 Token 活动，先补齐再让防抖推送带上去。
  if (!previous.cloudSyncEnabled && settings.cloudSyncEnabled) {
    refreshAllForRemote().catch(() => {});
  }
  if (previous.language !== settings.language && settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setTitle(tr('settingsTitle'));
  }
  for (const id of OPTIONAL_PROVIDER_IDS) {
    const wasEnabled = Boolean(previous.providerSettings?.[id]?.enabled);
    const nowEnabled = Boolean(settings.providerSettings[id]?.enabled);
    const keyChanged = (previous.providerSettings?.[id]?.apiKey || '') !== settings.providerSettings[id].apiKey;
    if (nowEnabled && (!wasEnabled || keyChanged)) {
      refreshProvider(id).catch(() => {});
    } else if (!nowEnabled && wasEnabled) {
      clearProviderState(id);
    }
  }
  updateTrayTitle();
  sendState();
  sendSettings();
  if (!previous.autoSwitchProvider && settings.autoSwitchProvider) {
    foregroundProviderTracker.clearManualOverride();
    setImmediate(applyForegroundProvider);
  }
  return getSettingsSnapshot();
}

function normalizeSettings(value) {
  const allowedLanguages = new Set(['zh-CN', 'en-US', 'ja-JP']);
  const providerSettings = normalizeProviderSettings(value);
  return {
    language: allowedLanguages.has(value?.language) ? value.language : defaultSettings.language,
    openAtLogin: Boolean(value?.openAtLogin),
    autoHideWithMenuBar: value?.autoHideWithMenuBar === undefined
      ? defaultSettings.autoHideWithMenuBar
      : Boolean(value.autoHideWithMenuBar),
    autoSwitchProvider: value?.autoSwitchProvider === undefined
      ? defaultSettings.autoSwitchProvider
      : Boolean(value.autoSwitchProvider),
    notificationsEnabled: value?.notificationsEnabled === undefined
      ? defaultSettings.notificationsEnabled
      : Boolean(value.notificationsEnabled),
    alertThresholds: ALERT_THRESHOLD_PRESETS.includes(String(value?.alertThresholds))
      ? String(value.alertThresholds)
      : defaultSettings.alertThresholds,
    paceAlertsEnabled: value?.paceAlertsEnabled === undefined
      ? defaultSettings.paceAlertsEnabled
      : Boolean(value.paceAlertsEnabled),
    webhookUrl: normalizeWebhookUrl(value?.webhookUrl),
    appearance: APPEARANCES.includes(value?.appearance) ? value.appearance : defaultSettings.appearance,
    hotkeyEnabled: value?.hotkeyEnabled === undefined
      ? defaultSettings.hotkeyEnabled
      : Boolean(value.hotkeyEnabled),
    mobileEnabled: value?.mobileEnabled === undefined
      ? defaultSettings.mobileEnabled
      : Boolean(value.mobileEnabled),
    mobileListenScope: MOBILE_LISTEN_SCOPES.includes(value?.mobileListenScope)
      ? value.mobileListenScope
      : defaultSettings.mobileListenScope,
    mobileAccessToken: /^[A-Za-z0-9_-]{24,128}$/.test(String(value?.mobileAccessToken || ''))
      ? String(value.mobileAccessToken)
      : defaultSettings.mobileAccessToken,
    cloudSyncEnabled: value?.cloudSyncEnabled === undefined
      ? defaultSettings.cloudSyncEnabled
      : Boolean(value.cloudSyncEnabled),
    cloudSyncServerUrl: typeof value?.cloudSyncServerUrl === 'string'
      ? value.cloudSyncServerUrl.trim().slice(0, 2048)
      : defaultSettings.cloudSyncServerUrl,
    cloudSyncAccountId: /^[A-Za-z0-9_-]{20,64}$/.test(String(value?.cloudSyncAccountId || ''))
      ? String(value.cloudSyncAccountId)
      : '',
    provider: normalizeProviderId(value?.provider, providerSettings),
    providerSettings
  };
}

function clearProviderState(provider) {
  if (provider === 'claude') {
    state.claudeUsage = idleSlice();
    state.claudeRadar = idleSlice();
    state.claudeActivity = idleSlice();
    state.claudeStatus = idleSlice();
    return;
  }
  if (EXTRA_PROVIDER_IDS.includes(provider)) state[`${provider}Usage`] = idleSlice();
}

function applySystemSettings() {
  if (!app.isPackaged || process.execPath.startsWith('/Volumes/')) return;
  app.setLoginItemSettings({
    openAtLogin: Boolean(settings.openAtLogin),
    openAsHidden: true
  });
}

function getSettingsSnapshot() {
  const lanBaseUrl = getMobileLanBaseUrl();
  const localAccessUrl = mobileRuntime.localBaseUrl
    ? createMobileAccessUrl(mobileRuntime.localBaseUrl)
    : null;
  const lanAccessUrl = lanBaseUrl
    ? createMobileAccessUrl(lanBaseUrl)
    : null;
  const remoteAccessUrl = mobileRuntime.remoteBaseUrl && settings.mobileListenScope !== 'local'
    ? createMobileAccessUrl(mobileRuntime.remoteBaseUrl)
    : null;
  return {
    ...settings,
    loginItemOpenAtLogin: app.getLoginItemSettings().openAtLogin,
    mobileRuntime: {
      ...mobileRuntime,
      lanBaseUrl,
      localAccessUrl,
      lanAccessUrl,
      remoteAccessUrl,
      preferredAccessUrl: remoteAccessUrl || lanAccessUrl || localAccessUrl
    },
    cloudSyncRuntime: {
      ...cloudSyncRuntime,
      configured: Boolean(settings.cloudSyncServerUrl && settings.cloudSyncAccountId),
      serverUrl: settings.cloudSyncServerUrl || null,
      accountId: settings.cloudSyncAccountId || null
    }
  };
}

function sendSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('settings:update', getSettingsSnapshot());
  }
}

function createMobileAccessUrl(baseUrl) {
  if (!baseUrl || !settings.mobileAccessToken) return null;
  return `${String(baseUrl).replace(/\/+$/, '')}/mobile/?token=${encodeURIComponent(settings.mobileAccessToken)}`;
}

function getMobileLanBaseUrl() {
  if (!mobileRuntime.running || !mobileRuntime.port) return null;
  if ((settings.mobileListenScope || 'lan') !== 'lan') return null;
  const address = findPreferredLanAddress(os.networkInterfaces());
  return address ? `http://${address}:${mobileRuntime.port}` : null;
}

function getPreferredMobileAccessUrl() {
  const remoteUrl = mobileRuntime.remoteBaseUrl && settings.mobileListenScope !== 'local'
    ? createMobileAccessUrl(mobileRuntime.remoteBaseUrl)
    : null;
  const lanBaseUrl = getMobileLanBaseUrl();
  const lanUrl = lanBaseUrl ? createMobileAccessUrl(lanBaseUrl) : null;
  return remoteUrl || lanUrl || createMobileAccessUrl(mobileRuntime.localBaseUrl);
}

// 访问范围：lan = 监听所有网卡；tailscale = 只听回环地址（Tailscale Serve 就是转发到回环地址）；
// local = 只听回环地址，并拒绝经代理转来的请求。改范围要换监听地址，所以重建服务。
let mobileServerScope = null;

function mobileListenOptions(scope) {
  if (scope === 'local') return { host: MOBILE_LOOPBACK_HOST, rejectProxied: true };
  if (scope === 'tailscale') return { host: MOBILE_LOOPBACK_HOST, rejectProxied: false };
  return { host: MOBILE_HOST, rejectProxied: false };
}

async function syncMobileServer({ restart = false } = {}) {
  const scope = settings.mobileListenScope || 'lan';
  if (mobileServer && (restart || mobileServerScope !== scope)) {
    await mobileServer.stop();
    mobileServer = null;
    mobileServerScope = null;
  }
  if (!settings.mobileEnabled) {
    if (mobileServer) await mobileServer.stop();
    mobileRuntime = {
      ...mobileRuntime,
      running: false,
      port: null,
      localBaseUrl: null,
      error: null
    };
    sendSettings();
    return mobileRuntime;
  }

  if (!mobileServer) {
    mobileServer = createMobileServer({
      assetsDir: MOBILE_ASSETS_DIR,
      getAccessToken: () => settings.mobileAccessToken,
      getState: () => state,
      onRefresh: refreshAllForRemote,
      ...mobileListenOptions(scope),
      port: MOBILE_PORT
    });
    mobileServerScope = scope;
  }

  try {
    const address = await mobileServer.start();
    const activePort = typeof address === 'object' && address ? address.port : MOBILE_PORT;
    mobileRuntime = {
      ...mobileRuntime,
      running: true,
      port: activePort,
      localBaseUrl: `http://${MOBILE_LOOPBACK_HOST}:${activePort}`,
      error: null
    };
    refreshAllForRemote().catch(() => {});
  } catch (error) {
    mobileRuntime = {
      ...mobileRuntime,
      running: false,
      port: null,
      localBaseUrl: null,
      error: error.code === 'EADDRINUSE'
        ? `端口 ${MOBILE_PORT} 已被其他程序占用`
        : error.message
    };
  }
  await refreshTailscaleRuntime();
  sendSettings();
  return mobileRuntime;
}

async function findTailscaleBinary() {
  try {
    const { stdout } = await execFileAsync('/usr/bin/which', ['tailscale'], { timeout: 3000 });
    const binary = stdout.trim();
    if (binary) return binary;
  } catch {
    // 继续检查常见安装位置。
  }

  const candidates = [
    '/opt/homebrew/bin/tailscale',
    '/usr/local/bin/tailscale',
    '/Applications/Tailscale.app/Contents/MacOS/Tailscale'
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // 检查下一个候选位置。
    }
  }
  return null;
}

async function refreshTailscaleRuntime() {
  const binary = await findTailscaleBinary();
  if (!binary) {
    mobileRuntime = {
      ...mobileRuntime,
      remoteBaseUrl: null,
      tailscaleInstalled: false,
      tailscaleState: 'not-installed'
    };
    return mobileRuntime;
  }

  try {
    const { stdout } = await execFileAsync(binary, ['status', '--json'], { timeout: 5000 });
    const status = JSON.parse(stdout);
    const dnsName = String(status?.Self?.DNSName || '').replace(/\.$/, '');
    if (status?.BackendState !== 'Running' || !dnsName) {
      mobileRuntime = {
        ...mobileRuntime,
        remoteBaseUrl: null,
        tailscaleInstalled: true,
        tailscaleState: 'disconnected'
      };
      return mobileRuntime;
    }

    let configured = false;
    try {
      const result = await execFileAsync(binary, ['serve', 'status', '--json'], { timeout: 5000 });
      const raw = String(result.stdout || '');
      configured = raw.includes(`127.0.0.1:${MOBILE_PORT}`)
        || raw.includes(`localhost:${MOBILE_PORT}`);
    } catch {
      configured = false;
    }
    mobileRuntime = {
      ...mobileRuntime,
      remoteBaseUrl: configured ? `https://${dnsName}` : null,
      tailscaleInstalled: true,
      tailscaleState: configured ? 'ready' : 'not-configured'
    };
  } catch (error) {
    mobileRuntime = {
      ...mobileRuntime,
      remoteBaseUrl: null,
      tailscaleInstalled: true,
      tailscaleState: 'error',
      error: mobileRuntime.error || error.message
    };
  }
  return mobileRuntime;
}

async function configureTailscaleServe() {
  if (!settings.mobileEnabled || !mobileRuntime.running) {
    return { ok: false, error: '请先启用手机联动' };
  }
  const binary = await findTailscaleBinary();
  if (!binary) {
    shell.openExternal(TAILSCALE_DOWNLOAD_URL);
    return { ok: false, error: 'Tailscale 尚未安装', openedDownload: true };
  }

  try {
    await execFileAsync(
      binary,
      ['serve', '--bg', '--yes', `http://${MOBILE_LOOPBACK_HOST}:${MOBILE_PORT}`],
      { timeout: 30_000 }
    );
    await refreshTailscaleRuntime();
    sendSettings();
    return {
      ok: mobileRuntime.tailscaleState === 'ready',
      settings: getSettingsSnapshot(),
      error: mobileRuntime.tailscaleState === 'ready' ? null : 'Tailscale Serve 尚未就绪'
    };
  } catch (error) {
    const output = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');
    const consentUrl = output.match(/https:\/\/[^\s]+/)?.[0];
    if (consentUrl) shell.openExternal(consentUrl);
    mobileRuntime = {
      ...mobileRuntime,
      tailscaleInstalled: true,
      tailscaleState: consentUrl ? 'needs-consent' : 'error',
      error: consentUrl ? '请在浏览器完成 Tailscale HTTPS 授权' : error.message
    };
    sendSettings();
    return { ok: false, error: mobileRuntime.error, openedConsent: Boolean(consentUrl) };
  }
}

function createMobileQrDataUrl() {
  const accessUrl = getPreferredMobileAccessUrl();
  if (!accessUrl) return null;
  const qr = qrcode(0, 'M');
  qr.addData(accessUrl);
  qr.make();
  return qr.createDataURL(5, 4);
}

function cloudSyncErrorMessage(error) {
  const code = String(error?.message || error || 'sync_failed');
  const known = {
    invalid_server_url: '同步服务器地址无效',
    insecure_server_url: '同步服务器必须使用 HTTPS',
    keychain_missing: '同步密钥在钥匙串中不存在',
    unauthorized: '同步凭证已失效，请重置配对',
    snapshot_not_found: '云端尚无同步数据',
    stale_snapshot: '云端已有更新的数据',
    request_timeout: '连接同步服务器超时'
  };
  if (known[code]) return known[code];
  if (/^http_\d+$/.test(code)) return `同步服务器请求失败（${code.slice(5)}）`;
  return code;
}

function disableCloudSyncRuntime() {
  if (cloudSyncPushTimer) clearTimeout(cloudSyncPushTimer);
  cloudSyncPushTimer = null;
  cloudSyncPushPending = false;
  lastCloudSyncSignature = null;
  lastCloudSyncUploadAt = 0;
  cloudSyncRuntime = {
    ...cloudSyncRuntime,
    status: 'disabled',
    error: null
  };
}

async function readCloudSyncSecret(accountId) {
  if (!accountId) throw new Error('keychain_missing');
  if (cloudSyncSecretCache?.accountId === accountId) return cloudSyncSecretCache.secret;
  try {
    const { stdout } = await execFileAsync('/usr/bin/security', [
      'find-generic-password',
      '-s', CLOUD_SYNC_KEYCHAIN_SERVICE,
      '-a', accountId,
      '-w'
    ], { timeout: 5000, maxBuffer: 1024 * 1024 });
    const secret = stdout.trim();
    validateCloudSyncCredentials({ accountId, secret });
    cloudSyncSecretCache = { accountId, secret };
    return secret;
  } catch {
    throw new Error('keychain_missing');
  }
}

async function writeCloudSyncSecret(credentials) {
  validateCloudSyncCredentials(credentials);
  await execFileAsync('/usr/bin/security', [
    'add-generic-password',
    '-U',
    '-s', CLOUD_SYNC_KEYCHAIN_SERVICE,
    '-a', credentials.accountId,
    '-w', credentials.secret
  ], { timeout: 5000, maxBuffer: 1024 * 1024 });
  cloudSyncSecretCache = {
    accountId: credentials.accountId,
    secret: credentials.secret
  };
}

async function deleteCloudSyncSecret(accountId) {
  if (!accountId) return;
  try {
    await execFileAsync('/usr/bin/security', [
      'delete-generic-password',
      '-s', CLOUD_SYNC_KEYCHAIN_SERVICE,
      '-a', accountId
    ], { timeout: 5000, maxBuffer: 1024 * 1024 });
  } catch {
    // The key may already be gone; resetting should still continue.
  }
  if (cloudSyncSecretCache?.accountId === accountId) cloudSyncSecretCache = null;
}

async function getCloudSyncCredentials() {
  const accountId = settings.cloudSyncAccountId;
  const secret = await readCloudSyncSecret(accountId);
  return validateCloudSyncCredentials({ accountId, secret });
}

async function createAndStoreCloudSyncCredentials() {
  const credentials = createCloudSyncCredentials();
  await writeCloudSyncSecret(credentials);
  return credentials;
}

async function cloudSyncFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await net.fetch(url, { ...options, credentials: 'omit', signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('request_timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function cloudSyncSnapshotUrl(serverUrl, accountId) {
  return `${normalizeCloudSyncServerUrl(serverUrl)}/v1/snapshots/${encodeURIComponent(accountId)}`;
}

async function uploadCloudSyncSnapshot({ force = false } = {}) {
  if (!settings.cloudSyncEnabled) return null;
  if (cloudSyncInFlight) {
    if (force) {
      // 改地址、重置配对要按新的地址和密钥重传；在途那次可能还是旧账号、旧地址，不能拿它充数。
      await cloudSyncInFlight.catch(() => null);
      return uploadCloudSyncSnapshot({ force: true });
    }
    cloudSyncPushPending = true;
    return cloudSyncInFlight;
  }
  const payload = createMobilePayload(state);
  const signature = mobilePayloadSignature(payload);
  if (
    !force
    && signature === lastCloudSyncSignature
    && cloudSyncRuntime.status === 'ready'
    && Date.now() - lastCloudSyncUploadAt < CLOUD_SYNC_HEARTBEAT_MS - 5_000
  ) {
    return null;
  }
  cloudSyncInFlight = (async () => {
    cloudSyncRuntime = {
      ...cloudSyncRuntime,
      status: 'syncing',
      lastAttemptAt: Date.now(),
      error: null
    };
    sendSettings();
    try {
      const serverUrl = normalizeCloudSyncServerUrl(settings.cloudSyncServerUrl);
      const credentials = await getCloudSyncCredentials();
      payload.sync = {
        source: 'mac',
        generatedAt: Date.now(),
        heartbeatMs: CLOUD_SYNC_HEARTBEAT_MS
      };
      const envelope = await encryptCloudSyncPayload(payload, credentials, payload.sync.generatedAt);
      const { authToken } = await deriveCloudSyncMaterial(credentials);
      const response = await cloudSyncFetch(cloudSyncSnapshotUrl(serverUrl, credentials.accountId), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envelope)
      });
      if (!response.ok) {
        let code = `http_${response.status}`;
        try {
          code = (await response.json()).error || code;
        } catch {
          // Keep the HTTP fallback code.
        }
        throw new Error(code);
      }
      lastCloudSyncSignature = signature;
      lastCloudSyncUploadAt = Date.now();
      cloudSyncRuntime = {
        status: 'ready',
        lastSyncedAt: envelope.updatedAt,
        lastAttemptAt: Date.now(),
        error: null
      };
      return envelope;
    } catch (error) {
      cloudSyncRuntime = {
        ...cloudSyncRuntime,
        status: 'error',
        lastAttemptAt: Date.now(),
        error: cloudSyncErrorMessage(error)
      };
      if (force) throw error;
      return null;
    } finally {
      sendSettings();
    }
  })();
  try {
    return await cloudSyncInFlight;
  } finally {
    cloudSyncInFlight = null;
    if (cloudSyncPushPending) {
      cloudSyncPushPending = false;
      queueCloudSyncPush(CLOUD_SYNC_PUSH_DELAY_MS);
    }
  }
}

function queueCloudSyncPush(delay = CLOUD_SYNC_PUSH_DELAY_MS) {
  if (!settings.cloudSyncEnabled) return;
  if (cloudSyncPushTimer) clearTimeout(cloudSyncPushTimer);
  cloudSyncPushTimer = setTimeout(() => {
    cloudSyncPushTimer = null;
    uploadCloudSyncSnapshot().catch(() => {});
  }, delay);
  cloudSyncPushTimer.unref?.();
}

async function configureCloudSync({ enabled, serverUrl } = {}) {
  if (!enabled) {
    await saveSettings({ cloudSyncEnabled: false });
    return getSettingsSnapshot();
  }
  const normalizedServerUrl = normalizeCloudSyncServerUrl(serverUrl || settings.cloudSyncServerUrl);
  let credentials;
  try {
    credentials = await getCloudSyncCredentials();
  } catch {
    credentials = await createAndStoreCloudSyncCredentials();
  }
  await saveSettings({
    cloudSyncEnabled: true,
    cloudSyncServerUrl: normalizedServerUrl,
    cloudSyncAccountId: credentials.accountId
  });
  await uploadCloudSyncSnapshot({ force: true });
  return getSettingsSnapshot();
}

async function getCloudSyncPairingInfo() {
  if (!settings.cloudSyncEnabled) return null;
  const credentials = await getCloudSyncCredentials();
  const pairingUrl = createCloudSyncPairingUrl(settings.cloudSyncServerUrl, credentials);
  return {
    pairingUrl,
    recoveryCode: createCloudSyncRecoveryCode(credentials),
    accountId: credentials.accountId
  };
}

async function createCloudSyncQrDataUrl() {
  try {
    const info = await getCloudSyncPairingInfo();
    if (!info) return null;
    const qr = qrcode(0, 'M');
    qr.addData(info.pairingUrl);
    qr.make();
    return qr.createDataURL(5, 4);
  } catch {
    return null;
  }
}

async function deleteCloudSnapshot(credentials, serverUrl) {
  if (!credentials || !serverUrl) return;
  try {
    const { authToken } = await deriveCloudSyncMaterial(credentials);
    await cloudSyncFetch(cloudSyncSnapshotUrl(serverUrl, credentials.accountId), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
  } catch {
    // Rotation must work even when the old server is unavailable.
  }
}

async function resetCloudSyncPairing() {
  let previousCredentials = null;
  try {
    previousCredentials = await getCloudSyncCredentials();
  } catch {
    // A missing old key is one of the reasons to reset.
  }
  // 先等在途的上传结束：它若晚于 DELETE 到达，会把旧快照写回旧账号，已撤销的手机还能读到。
  await cloudSyncInFlight?.catch(() => null);
  await deleteCloudSnapshot(previousCredentials, settings.cloudSyncServerUrl);
  await deleteCloudSyncSecret(settings.cloudSyncAccountId);
  const credentials = await createAndStoreCloudSyncCredentials();
  await saveSettings({ cloudSyncAccountId: credentials.accountId });
  await uploadCloudSyncSnapshot({ force: true });
  return getSettingsSnapshot();
}

async function getCodexRequestHeaders() {
  let raw;
  try {
    raw = await fs.readFile(AUTH_PATH, 'utf8');
  } catch {
    throw new Error(tr('errCodexAuthMissing'));
  }

  let auth;
  try {
    auth = JSON.parse(raw);
  } catch {
    throw new Error(tr('errCodexAuthInvalid'));
  }

  const token = auth?.tokens?.access_token;
  if (!token) throw new Error(tr('errCodexAuthNoToken'));
  return {
    Authorization: `Bearer ${token}`,
    ...(auth.tokens.account_id ? { 'ChatGPT-Account-Id': auth.tokens.account_id } : {})
  };
}

async function fetchJson(url, options = {}) {
  const { requestTimeoutMs = REQUEST_TIMEOUT_MS, ...requestOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    // Chromium 的网络栈读取 macOS 系统代理；Node fetch 会绕过它，直连被拦域名。
    const response = await net.fetch(url, {
      ...requestOptions,
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': `CodexMenuMeter/${app.getVersion()}`,
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.url = url;
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) error.retryAfterMs = /^\d+(?:\.\d+)?$/.test(retryAfter)
        ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
      throw error;
    }
    try {
      return JSON.parse(text);
    } catch {
      const error = new Error(tr('errInvalidJsonResponse'));
      error.code = 'invalid-json-response';
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }
}

function requestErrorMessage(error, provider) {
  if (error?.status === 401) return tr('errExpired', { provider });
  const detail = `${error?.code || ''} ${error?.message || ''} ${error?.cause?.code || ''}`;
  if (error?.name === 'AbortError' || /TIMED?_?OUT|TIMEOUT/i.test(detail)) return tr('errTimeout', { provider });
  if (/ERR_(PROXY|TUNNEL)/i.test(detail)) return tr('errSystemProxy');
  if (/fetch failed|ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION|NETWORK)/i.test(detail)) return tr('errNetwork', { provider });
  if (error?.status) return tr('errHttp', { status: error.status });
  return error?.message || tr('errFetch', { provider });
}

function refreshUsage() {
  return refreshStateSlice('codex-usage', 'usage', async () => {
    const headers = await getCodexRequestHeaders();
    const [usage, resetCredits] = await Promise.all([
      fetchJson(CODEX_USAGE_URL, { headers }),
      fetchJson(RESET_CREDITS_URL, { headers })
        .catch((error) => ({ error: requestErrorMessage(error, 'Codex') }))
    ]);
    return normalizeUsage(usage, resetCredits);
  }, {
    formatError: (error) => requestErrorMessage(error, 'Codex'),
    onSettled: () => {
      syncActivityWindows('codex');
      updateTrayTitle();
      recordUsageSample('codex');
      scheduleResetRefresh();
    }
  });
}

function normalizeUsage(raw, resetCredits) {
  if (!raw?.rate_limit || typeof raw.rate_limit !== 'object') throw new Error(tr('errUsageResponseInvalid'));
  const rateLimit = raw?.rate_limit || {};
  const resetCreditSummary = resetCredits?.error
    ? {
        availableCount: raw?.rate_limit_reset_credits?.available_count ?? 0,
        credits: [],
        error: resetCredits.error
      }
    : {
        availableCount: resetCredits?.available_count ?? raw?.rate_limit_reset_credits?.available_count ?? 0,
        credits: Array.isArray(resetCredits?.credits)
          ? resetCredits.credits.map((credit) => ({
              status: credit.status,
              title: credit.title,
              expiresAt: credit.expires_at
            }))
          : [],
        error: null
      };

  // Codex 已取消 5 小时限制的账号只返回一个周窗口（primary 位就是周），
  // 所以按 limit_window_seconds 归类，不再按位置对号入座。
  const windows = [rateLimit.primary_window, rateLimit.secondary_window].filter(Boolean);
  let fiveHour = null;
  let weekly = null;
  for (const windowValue of windows) {
    const span = Number(windowValue.limit_window_seconds) || 0;
    if (span >= 86_400) weekly = weekly || windowValue;
    else if (span > 0) fiveHour = fiveHour || windowValue;
  }
  if (!fiveHour && !weekly) {
    [fiveHour, weekly] = [rateLimit.primary_window, rateLimit.secondary_window];
  }

  return {
    planType: raw?.plan_type || null,
    limitReached: Boolean(rateLimit.limit_reached),
    primaryWindow: normalizeWindow(fiveHour),
    secondaryWindow: normalizeWindow(weekly),
    fiveHourUnlimited: !fiveHour && Boolean(weekly),
    resetCredits: resetCreditSummary
  };
}

function normalizeWindow(windowValue) {
  if (!windowValue) return null;
  const usedPercent = clamp(Math.round(Number(windowValue.used_percent ?? 0)), 0, 100);
  const resetAfterSeconds = Number(windowValue.reset_after_seconds ?? 0);
  const resetAt = Number(windowValue.reset_at ?? 0);
  return {
    usedPercent,
    remainingPercent: clamp(100 - usedPercent, 0, 100),
    resetAt: resetAt
      ? resetAt * 1000
      : resetAfterSeconds > 0
        ? Date.now() + resetAfterSeconds * 1000
        : null
  };
}

const readRadarBench = createRadarBenchReader(fetchJson);

function refreshRadar() {
  return refreshStateSlice('codex-radar', 'radar', async () => {
    const previous = state.radar.data;
    const createData = (modelIq) => ({
      sourceUrl: RADAR_HOME, monitoredAt: modelIq.updatedAt,
      modelIq: { ...modelIq, items: mergeCatalogItems(modelIq.items, codexModelCatalog) },
      quotaRadar: previous?.quotaRadar || { updatedAt: null, rows: [] }
    });
    // 旧 current.json 仅保留额度参考；IQ 使用网页当前公开的 RadarBench 接口。
    const quotaRead = fetchJson(RADAR_URL, { headers: { Referer: RADAR_HOME } })
      .then((raw) => raw?.model_iq?.quota_radar).catch(() => null);
    const modelIq = await readRadarBench({
      previous: previous?.modelIq,
      onProgress: (partial) => {
        state.radar = { ...state.radar, data: createData(partial) };
        sendState();
      }
    });
    const normalized = createData(modelIq);
    const quota = await quotaRead;
    if (Array.isArray(quota?.rows)) normalized.quotaRadar = { updatedAt: quota.updated_at || null, rows: quota.rows };
    await cacheRadarData('codex', normalized);
    return normalized;
  }, { formatError: (error) => requestErrorMessage(error, 'Codex Radar') });
}

// 仅保存公开雷达快照；短暂断网或上游停供时保留最后一次有效测评，不包含登录凭据。
const radarCache = {};
let radarCacheWrite = Promise.resolve();

function cacheRadarData(provider, data) {
  radarCache[provider] = { data, fetchedAt: Date.now() };
  const serialized = JSON.stringify({ version: 1, providers: radarCache });
  radarCacheWrite = radarCacheWrite.then(() => fs.writeFile(RADAR_CACHE_PATH, serialized, 'utf8')).catch(() => {});
  return radarCacheWrite;
}

async function loadRadarCache() {
  try {
    const cached = JSON.parse(await fs.readFile(RADAR_CACHE_PATH, 'utf8'));
    if (cached.version !== 1) return;
    for (const [provider, key] of [['codex', 'radar'], ['claude', 'claudeRadar']]) {
      const snapshot = cached.providers?.[provider];
      const items = provider === 'codex' ? snapshot?.data?.modelIq?.items : snapshot?.data?.items;
      if (!Array.isArray(items) || !items.some((item) => !item.catalogOnly && finiteNumber(item.score) !== null)) continue;
      radarCache[provider] = snapshot;
      state[key] = { ...state[key], ...snapshot, status: 'refreshing', error: null };
      if (provider === 'codex') state[key].data.modelIq.items = mergeCatalogItems(items, codexModelCatalog);
    }
  } catch {
    // 首次启动或缓存损坏时使用在线源，不影响其他数据源刷新。
  }
}

function refreshTokenActivity() {
  return refreshStateSlice('codex-activity', 'tokenActivity', readTokenActivity, {
    formatError: (error) => requestErrorMessage(error, 'Codex')
  });
}

async function readTokenActivity() {
  return readCodexLocalActivity();
}

async function readCodexLocalActivity() {
  const entries = await collectCodexEntries();
  return buildLocalActivity(entries, 'codex_local', state.usage?.data);
}

function normalizeRadar(raw) {
  const modelIq = raw?.model_iq || {};
  const comparisons = modelIq.comparisons || {};
  const items = [];
  const seenModels = new Set();

  if (modelIq.latest) {
    appendIqItem(items, seenModels, null, modelIq.latest, modelIq.recent_days);
  }

  Object.values(comparisons).forEach((value) => {
    if (value?.latest) appendIqItem(items, seenModels, value.label, value.latest, value.recent_days);
  });
  if (raw !== null && !items.length) throw new Error(tr('errRadarNoMetrics'));

  return {
    monitoredAt: raw?.monitored_at || null,
    modelIq: {
      latestDate: modelIq.latest?.date || null,
      updatedAt: modelIq.latest?.updated_at || modelIq.updated_at || null,
      items: mergeCatalogItems(items, codexModelCatalog)
    },
    quotaRadar: {
      updatedAt: modelIq.quota_radar?.updated_at || null,
      rows: Array.isArray(modelIq.quota_radar?.rows) ? modelIq.quota_radar.rows : []
    },
    sourceUrl: raw?.links?.html || RADAR_HOME
  };
}

async function refreshModelCatalog() {
  try {
    const cached = JSON.parse(await fs.readFile(MODEL_CATALOG_PATH, 'utf8'));
    const next = readModelCatalog(cached);
    if (JSON.stringify(next) === JSON.stringify(codexModelCatalog)) return;
    codexModelCatalog = next;
    if (state.radar.data?.modelIq) {
      state.radar.data.modelIq.items = mergeCatalogItems(state.radar.data.modelIq.items || [], codexModelCatalog);
      sendState();
    }
  } catch {
    // Codex 缓存暂不可读或正在替换时保留已知目录，下次自动重试。
  }
}

function appendIqItem(items, seenModels, label, latest, recentDays = []) {
  const identity = normalizeIqIdentity(label, latest);
  const identityKey = `${identity.modelLabel.toLowerCase()}|${identity.reasoningEffort.toLowerCase()}`;
  if (seenModels.has(identityKey)) return;
  seenModels.add(identityKey);
  const sampleSeries = normalizeIqSampleSeries(recentDays, latest);
  const validTasks = Number(latest.valid_tasks ?? latest.tasks);
  const averageCostUsd = finiteNumber(latest.average_cost_usd)
    ?? (finiteNumber(latest.cost_usd) !== null && Number.isFinite(validTasks) && validTasks > 0
      ? Number(latest.cost_usd) / validTasks
      : null);
  const averageTaskSeconds = finiteNumber(latest.average_task_seconds)
    ?? (finiteNumber(latest.wall_seconds) !== null && Number.isFinite(validTasks) && validTasks > 0
      ? Number(latest.wall_seconds) / validTasks
      : null);
  items.push({
    label: identity.label,
    modelLabel: identity.modelLabel,
    reasoningEffort: identity.reasoningEffort,
    score: latest.score,
    status: latest.status,
    passed: latest.passed,
    tasks: latest.tasks,
    costUsd: latest.cost_usd,
    wallTimeHuman: latest.wall_time_human,
    averageCostUsd,
    averageTaskSeconds,
    averageTaskTimeHuman: latest.average_task_time_human || null,
    sampleCount24h: sampleSeries.length || finiteNumber(latest.sample_count_24h),
    recentScores: sampleSeries
  });
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeIqSampleSeries(recentDays, latest) {
  const samples = Array.isArray(recentDays) ? recentDays : [];
  const latestDate = Date.parse(String(latest?.date || ''));
  const anchor = Number.isFinite(latestDate) ? latestDate : Date.now();
  const start = anchor - 24 * 60 * 60 * 1000;
  const byDate = new Map();

  [...samples, latest].forEach((sample) => {
    const score = finiteNumber(sample?.score);
    const date = Date.parse(String(sample?.date || ''));
    if (score === null || !Number.isFinite(date) || date < start || date > anchor + 60 * 60 * 1000) return;
    byDate.set(date, { date, score });
  });

  return [...byDate.values()].sort((left, right) => left.date - right.date);
}

function normalizeIqIdentity(label, latest) {
  const reasoningEffort = String(latest?.reasoning_effort || '').trim().toLowerCase();
  const modelLabel = formatIqModelName(latest?.model, label, reasoningEffort);
  return {
    modelLabel,
    reasoningEffort,
    label: [modelLabel, reasoningEffort].filter(Boolean).join(' ')
  };
}

function formatIqModelName(model, fallbackLabel, reasoningEffort) {
  const rawModel = String(model || '').trim();
  const modelMatch = rawModel.match(/^(gpt-\d+(?:\.\d+)*)(?:-(.+))?$/i);
  if (modelMatch) {
    const family = modelMatch[1].replace(/^gpt/i, 'GPT');
    const variant = String(modelMatch[2] || '')
      .split('-')
      .filter(Boolean)
      .map(titleCaseModelPart)
      .join(' ');
    return [family, variant].filter(Boolean).join(' ');
  }

  const fallback = String(fallbackLabel || rawModel || 'Model').trim();
  if (!reasoningEffort) return fallback;
  return fallback.replace(new RegExp(`\\s+${escapeRegex(reasoningEffort)}$`, 'i'), '').trim();
}

function titleCaseModelPart(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : '';
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let claudeCredentialCache = null;
let claudeCredentialIssue = null;
let claudeCredentialRefreshError = null;

async function getClaudeCredentials({ force = false, excludeSource = null, excludeAccessToken = null } = {}) {
  if (!force && claudeCredentialCache && (!claudeCredentialCache.expiresAt || claudeCredentialCache.expiresAt - Date.now() > 60_000)) {
    claudeCredentialIssue = null;
    return claudeCredentialCache;
  }
  if (force) {
    claudeCredentialIssue = null;
    claudeCredentialRefreshError = null;
  }

  const sources = [
    { id: 'file', read: readClaudeCredentialsFile, write: writeClaudeCredentialsFile },
    { id: 'keychain', read: readClaudeCredentialsKeychain, write: writeClaudeCredentialsKeychain }
  ];

  for (const source of sources) {
    if (source.id === excludeSource) continue;
    let oauth;
    try {
      oauth = await source.read();
    } catch {
      continue;
    }
    if (!oauth?.accessToken || oauth.accessToken === excludeAccessToken) continue;

    let credentials = {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken || null,
      expiresAt: Number(oauth.expiresAt) || null,
      subscriptionType: oauth.subscriptionType || null,
      source: source.id,
      raw: oauth,
      persist: source.write
    };

    const expiringSoon = credentials.expiresAt && credentials.expiresAt - Date.now() < 60_000;
    if (expiringSoon) {
      // 刷新令牌也过期时不必再打一次注定失败的请求，直接提示重新登录。
      if (!credentials.refreshToken || isRefreshTokenExpired(oauth)) {
        claudeCredentialIssue = 'expired';
        continue;
      }
      try {
        credentials = await refreshClaudeCredentials(credentials);
      } catch (error) {
        // 凭据确实存在，但已经过期且无法刷新；不要再误报成“未安装/未登录 CLI”。
        if ([400, 401].includes(error.status)) claudeCredentialIssue = 'expired';
        else claudeCredentialRefreshError = error;
        continue;
      }
    }

    claudeCredentialCache = credentials;
    claudeCredentialIssue = null;
    return credentials;
  }

  return null;
}

async function refreshClaudeCredentials(credentials) {
  if (!credentials?.refreshToken) return null;
  const refreshed = await refreshClaudeOAuth(credentials.refreshToken);
  const raw = mergeRefreshedOAuth(credentials.raw, refreshed);
  const next = { ...credentials, ...refreshed, raw };
  claudeCredentialCache = next;
  await credentials.persist?.(raw).catch(() => {});
  return next;
}

async function refreshClaudeOAuth(refreshToken) {
  const raw = await fetchJson(CLAUDE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLAUDE_OAUTH_CLIENT_ID
    })
  });
  if (!raw?.access_token) throw new Error(tr('errClaudeRefreshFailed'));
  const refreshed = {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token || refreshToken,
    expiresAt: Date.now() + (Number(raw.expires_in) || 3600) * 1000
  };
  const refreshTtl = Number(raw.refresh_token_expires_in);
  if (Number.isFinite(refreshTtl) && refreshTtl > 0) refreshed.refreshTokenExpiresAt = Date.now() + refreshTtl * 1000;
  return refreshed;
}

async function readClaudeCredentialsFile() {
  const raw = await fs.readFile(CLAUDE_CREDS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed?.claudeAiOauth || parsed;
}

async function writeClaudeCredentialsFile(oauth) {
  let container = {};
  try {
    container = JSON.parse(await fs.readFile(CLAUDE_CREDS_PATH, 'utf8'));
  } catch {
    container = {};
  }
  if (container && typeof container === 'object' && container.claudeAiOauth) {
    container.claudeAiOauth = { ...container.claudeAiOauth, ...oauth };
  } else {
    container = { ...container, ...oauth };
  }
  await fs.writeFile(CLAUDE_CREDS_PATH, JSON.stringify(container), 'utf8');
}

async function readClaudeCredentialsKeychain() {
  if (process.platform !== 'darwin') return null;
  const { stdout } = await execFileAsync(
    'security',
    ['find-generic-password', '-s', CLAUDE_KEYCHAIN_SERVICE, '-w'],
    { timeout: 5000 }
  );
  const parsed = JSON.parse(stdout.trim());
  return parsed?.claudeAiOauth || parsed;
}

async function writeClaudeCredentialsKeychain(oauth) {
  if (process.platform !== 'darwin') return;
  let container = null;
  try {
    const { stdout } = await execFileAsync(
      'security',
      ['find-generic-password', '-s', CLAUDE_KEYCHAIN_SERVICE, '-w'],
      { timeout: 5000 }
    );
    container = JSON.parse(stdout.trim());
  } catch {
    container = null;
  }
  const payload = container && typeof container === 'object' && container.claudeAiOauth
    ? { ...container, claudeAiOauth: { ...container.claudeAiOauth, ...oauth } }
    : { claudeAiOauth: oauth };
  await execFileAsync(
    'security',
    [
      'add-generic-password',
      '-U',
      '-a', os.userInfo().username,
      '-s', CLAUDE_KEYCHAIN_SERVICE,
      '-w', JSON.stringify(payload)
    ],
    { timeout: 5000 }
  );
}

function refreshClaudeUsage() {
  return refreshStateSlice('claude-usage', 'claudeUsage', readClaudeUsage, {
    formatError: claudeUsageErrorMessage,
    onSettled: () => {
      syncActivityWindows('claude');
      updateTrayTitle();
      recordUsageSample('claude');
      syncClaudeReconnectWatch();
      scheduleResetRefresh();
    }
  });
}

function claudeNeedsReconnect() {
  return state.claudeUsage.status === 'error' && CLAUDE_RECONNECT_CODES.has(state.claudeUsage.errorCode);
}

// Claude 断连（未登录 / 登录过期）时，每隔几秒看一眼本机凭据有没有被重新登录刷新。
// 只读文件和钥匙串，不发网络请求；一旦发现可用凭据就走正常刷新并停掉轮询。
function syncClaudeReconnectWatch() {
  const wanted = claudeNeedsReconnect() && isProviderEnabled('claude', settings.providerSettings);
  if (!wanted) {
    if (claudeReconnectTimer) clearInterval(claudeReconnectTimer);
    claudeReconnectTimer = null;
    return;
  }
  if (claudeReconnectTimer) return;
  claudeReconnectTimer = setInterval(async () => {
    if (!claudeNeedsReconnect()) return syncClaudeReconnectWatch();
    if (await hasUsableClaudeCredentials()) refreshClaudeUsage();
  }, CLAUDE_RECONNECT_POLL_MS);
  claudeReconnectTimer.unref?.();
}

async function hasUsableClaudeCredentials() {
  for (const read of [readClaudeCredentialsFile, readClaudeCredentialsKeychain]) {
    try {
      if (isCredentialUsable(await read())) return true;
    } catch {
      // 该来源不存在或读不到，继续看下一个。
    }
  }
  return false;
}

// 在「终端」里打开 Claude Code 的登录流程。用 .command 文件交给系统打开，
// 不需要辅助功能/自动化授权；登录由用户自己在浏览器里完成，本应用不接触账号密码。
async function startClaudeReconnect() {
  const scriptPath = path.join(app.getPath('userData'), 'claude-reconnect.command');
  const script = [
    '#!/bin/zsh',
    'clear',
    `echo "Codex Menu Meter · ${tr('claudeReconnectShellTitle')}"`,
    'echo',
    'if ! command -v claude >/dev/null 2>&1; then',
    `  echo "${tr('claudeReconnectShellMissing')}"`,
    '  echo "  npm install -g @anthropic-ai/claude-code"',
    '  exit 1',
    'fi',
    CLAUDE_LOGIN_COMMAND,
    'echo',
    `echo "${tr('claudeReconnectShellDone')}"`,
    ''
  ].join('\n');
  await fs.writeFile(scriptPath, script, { mode: 0o755 });
  await fs.chmod(scriptPath, 0o755);
  const failure = await shell.openPath(scriptPath);
  if (failure) throw new Error(failure);
  syncClaudeReconnectWatch();
  return { ok: true, command: CLAUDE_LOGIN_COMMAND };
}

function claudeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function readClaudeUsage() {
  let credentials = await getClaudeCredentials({ force: true });
  let officialError = null;

  if (credentials?.accessToken) {
    try {
      const official = await fetchClaudeOfficialUsage(credentials);
      if (official) return official;
      officialError = claudeError('claude-bad-data');
    } catch (error) {
      officialError = error;
      if (error?.status === 401 && credentials.refreshToken) {
        try {
          credentials = await refreshClaudeCredentials(credentials);
          const official = await fetchClaudeOfficialUsage(credentials);
          if (official) return official;
          officialError = claudeError('claude-bad-data');
        } catch (retryError) {
          officialError = retryError;
          claudeCredentialCache = null;
        }
      }
      if (error?.status === 401 || officialError?.status === 401) {
        const failedAccessToken = credentials.accessToken;
        claudeCredentialCache = null;
        const alternate = await getClaudeCredentials({ force: true, excludeAccessToken: failedAccessToken });
        if (alternate?.accessToken) {
          try {
            const official = await fetchClaudeOfficialUsage(alternate);
            if (official) return official;
          } catch (alternateError) {
            officialError = alternateError;
          }
        }
      }
    }
  } else {
    officialError = claudeCredentialRefreshError || claudeError(claudeCredentialIssue === 'expired'
      ? 'claude-auth-expired'
      : 'claude-no-creds');
  }

  throw officialError || claudeError('claude-unavailable');
}

// 套餐读账户接口：钥匙串里的 subscriptionType 只在登录时写一次，之后升级或降级都不会更新。
// 账户接口偶尔读不到时沿用上一次读到的套餐，从没读到过才退回钥匙串里的值。
let claudePlanSnapshot = null;

async function fetchClaudeOfficialUsage(credentials) {
  const headers = {
    Authorization: `Bearer ${credentials.accessToken}`,
    'anthropic-beta': 'oauth-2025-04-20'
  };
  const [raw, profile] = await Promise.all([
    // cedar_ember=1：让同一个请求顺带返回账号持有的「重置卡」（官方客户端 /limit-reset 的数据）。
    fetchJson(`${CLAUDE_USAGE_URL}?cedar_ember=1`, { headers }),
    // 套餐只是标题上的一个标注，读不到或太慢都不能拖住额度本身。
    fetchJson(CLAUDE_PROFILE_URL, { headers, requestTimeoutMs: 8_000 }).catch(() => null)
  ]);
  const livePlan = resolveClaudePlan(profile);
  if (livePlan) claudePlanSnapshot = livePlan;
  return normalizeClaudeOfficialUsage(raw, {
    planType: livePlan || claudePlanSnapshot || resolveClaudePlan(null, credentials?.subscriptionType)
  });
}

function claudeUsageErrorMessage(error) {
  if (error?.status === 429) return tr('errClaude429');
  if (error?.name === 'AbortError') return tr('errClaudeTimeout');
  if (Number(error?.status) >= 500) return tr('errClaude5xx');
  if (error?.code === 'claude-auth-expired') return tr('errClaudeAuthExpired');
  if (error?.code === 'claude-no-creds') return tr('errClaudeNoCli');
  if (error?.code === 'claude-bad-data') return tr('errClaudeBadData');
  if (error?.code === 'claude-unavailable') return tr('errClaudeUnavailable');
  return requestErrorMessage(error, 'Claude');
}

const claudeTranscriptCache = new Map();
let claudeEntriesSnapshot = { entries: null, scannedAt: 0 };
let claudeEntriesInflight = null;

async function collectClaudeEntries({ force = false } = {}) {
  if (!force && claudeEntriesSnapshot.entries && Date.now() - claudeEntriesSnapshot.scannedAt < CLAUDE_ENTRY_CACHE_MS) {
    return claudeEntriesSnapshot.entries;
  }
  if (claudeEntriesInflight) return claudeEntriesInflight;

  claudeEntriesInflight = collectClaudeEntriesNow();
  try {
    const entries = await claudeEntriesInflight;
    claudeEntriesSnapshot = { entries, scannedAt: Date.now() };
    return entries;
  } finally {
    claudeEntriesInflight = null;
  }
}

async function collectClaudeEntriesNow() {
  const files = await findClaudeTranscripts(CLAUDE_PROJECTS_DIR);
  const fileSet = new Set(files);
  for (const cachedFile of claudeTranscriptCache.keys()) {
    if (!fileSet.has(cachedFile)) claudeTranscriptCache.delete(cachedFile);
  }

  const seen = new Set();
  const entries = [];
  for (const file of files) {
    for (const entry of await readClaudeTranscript(file)) {
      if (entry.id) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
      }
      entries.push(entry);
    }
  }
  return entries;
}

async function findClaudeTranscripts(dir) {
  const files = [];
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const dirent of dirents) {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...await findClaudeTranscripts(full));
    } else if (dirent.isFile() && dirent.name.endsWith('.jsonl')) {
      files.push(full);
    }
  }
  return files;
}

async function readClaudeTranscript(file) {
  return readTranscriptFile(file, claudeTranscriptCache, parseClaudeTranscriptLines, {
    retainFromTs: activityWindowStartTs()
  });
}

function invalidateClaudeEntrySnapshot() {
  claudeEntriesSnapshot.scannedAt = 0;
}

const codexTranscriptCache = new Map();
let codexEntriesSnapshot = { entries: null, scannedAt: 0 };
let codexEntriesInflight = null;

async function collectCodexEntries({ force = false } = {}) {
  if (!force && codexEntriesSnapshot.entries && Date.now() - codexEntriesSnapshot.scannedAt < CLAUDE_ENTRY_CACHE_MS) {
    return codexEntriesSnapshot.entries;
  }
  if (codexEntriesInflight) return codexEntriesInflight;

  codexEntriesInflight = collectCodexEntriesNow();
  try {
    const entries = await codexEntriesInflight;
    codexEntriesSnapshot = { entries, scannedAt: Date.now() };
    return entries;
  } finally {
    codexEntriesInflight = null;
  }
}

async function collectCodexEntriesNow() {
  const cutoffTs = activityWindowStartTs();
  const files = [];
  const seenNames = new Set();
  for (const dir of CODEX_SESSIONS_DIRS) {
    for (const file of await findClaudeTranscripts(dir)) {
      const name = path.basename(file);
      if (seenNames.has(name)) continue;
      seenNames.add(name);
      files.push(file);
    }
  }

  const fileSet = new Set(files);
  for (const cachedFile of codexTranscriptCache.keys()) {
    if (!fileSet.has(cachedFile)) codexTranscriptCache.delete(cachedFile);
  }

  const entries = [];
  for (const file of files) {
    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      continue;
    }
    // mtime 早于统计窗口起点的文件不可能包含窗口内的事件，跳过以省掉大文件解析。
    if (stat.mtimeMs < cutoffTs) continue;
    // 文件名只是兜底：解析器能从 session_meta 拿到真正的线程 id 时优先用它，
    // 否则 subagent 的独立 rollout 文件会被算成一个额外会话。
    const fallbackSessionId = path.basename(file, '.jsonl');
    for (const entry of await readTranscriptFile(file, codexTranscriptCache, parseCodexRolloutLines, {
      retainFromTs: cutoffTs
    })) {
      if (!entry.sessionId) entry.sessionId = fallbackSessionId;
      entries.push(entry);
    }
  }
  return entries;
}

function invalidateCodexEntrySnapshot() {
  codexEntriesSnapshot.scannedAt = 0;
}

function refreshClaudeActivity() {
  return refreshStateSlice('claude-activity', 'claudeActivity', readClaudeActivity);
}

const ACTIVITY_WINDOW_DAYS = 30;

function activityWindowStartTs() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (ACTIVITY_WINDOW_DAYS - 1));
  return cutoff.getTime();
}

async function readClaudeActivity() {
  const entries = await collectClaudeEntries();
  if (!entries.length) throw new Error(tr('errNoLocalClaude'));
  return buildLocalActivity(entries, 'claude_local', state.claudeUsage?.data);
}

function buildLocalActivity(entries, source, usage) {
  const cutoffTs = activityWindowStartTs();
  const dayMap = new Map();
  const windowEntries = entries.filter((entry) => entry.ts >= cutoffTs);
  const projectOf = createProjectResolver(windowEntries.map((entry) => entry.cwd));
  for (const entry of windowEntries) {
    const day = formatLocalIsoDate(new Date(entry.ts));
    let bucket = dayMap.get(day);
    if (!bucket) {
      bucket = {
        day,
        weighted: 0,
        tokens: 0,
        ioTokens: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        costUsd: 0,
        unpricedTokens: 0,
        unpricedModels: new Set(),
        sessions: new Set(),
        models: new Map(),
        projects: new Map()
      };
      dayMap.set(day, bucket);
    }
    const cost = entryCostUsd(entry);
    bucket.weighted += entry.weighted;
    bucket.tokens += entry.tokens;
    bucket.ioTokens += entry.ioTokens;
    bucket.inputTokens += Number(entry.inputTokens) || 0;
    bucket.cachedInputTokens += Number(entry.cachedInputTokens) || 0;
    if (cost === null) {
      bucket.unpricedTokens += entry.tokens;
      bucket.unpricedModels.add(entry.model || '?');
    } else {
      bucket.costUsd += cost;
    }
    if (entry.sessionId) bucket.sessions.add(entry.sessionId);
    if (entry.model) {
      const model = bucket.models.get(entry.model) || { weighted: 0, tokens: 0, costUsd: 0, priced: cost !== null };
      model.weighted += entry.weighted;
      model.tokens += entry.tokens;
      if (cost !== null) model.costUsd += cost;
      bucket.models.set(entry.model, model);
    }
    const project = projectOf(entry.cwd);
    const projectTotals = bucket.projects.get(project.key) || {
      name: project.name,
      tokens: 0,
      ioTokens: 0,
      costUsd: 0,
      sessions: new Set()
    };
    projectTotals.tokens += entry.tokens;
    projectTotals.ioTokens += entry.ioTokens;
    if (cost !== null) projectTotals.costUsd += cost;
    if (entry.sessionId) projectTotals.sessions.add(entry.sessionId);
    bucket.projects.set(project.key, projectTotals);
  }

  const days = [...dayMap.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((bucket) => ({
      day: bucket.day,
      // value 是计费加权口径，只用来驱动热力图深浅；展示数字用 tokens / ioTokens。
      value: Math.round(bucket.weighted),
      tokens: bucket.tokens,
      ioTokens: bucket.ioTokens,
      inputTokens: bucket.inputTokens,
      cachedInputTokens: bucket.cachedInputTokens,
      costUsd: roundCents(bucket.costUsd),
      // 没有官方价的型号不计入费用，单独列出 token 数，界面标「未定价」。
      unpricedTokens: bucket.unpricedTokens,
      unpricedModels: [...bucket.unpricedModels],
      threads: bucket.sessions.size,
      models: [...bucket.models.entries()]
        .sort((a, b) => b[1].weighted - a[1].weighted)
        .map(([model, totals]) => ({
          model,
          value: totals.tokens,
          costUsd: totals.priced ? roundCents(totals.costUsd) : null
        })),
      projects: summarizeProjects(bucket.projects)
    }));

  return {
    source,
    units: 'tokens',
    windowDays: ACTIVITY_WINDOW_DAYS,
    pricingAsOf: PRICING_AS_OF,
    windows: buildActivityWindows(entries, usage),
    days
  };
}

function roundCents(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// 每天最多列 5 个项目，其余并成「其他」。只给目录名，不给完整路径（手机端和云同步也会带上）。
const PROJECTS_PER_DAY = 5;

function summarizeProjects(projects) {
  const list = [...projects.values()].sort((a, b) => b.tokens - a.tokens);
  const head = list.slice(0, PROJECTS_PER_DAY);
  const rest = list.slice(PROJECTS_PER_DAY);
  const rows = head.map((item) => ({
    name: item.name,
    tokens: item.tokens,
    ioTokens: item.ioTokens,
    costUsd: roundCents(item.costUsd),
    sessions: item.sessions.size
  }));
  if (rest.length) {
    rows.push({
      name: null,
      other: rest.length,
      tokens: rest.reduce((sum, item) => sum + item.tokens, 0),
      ioTokens: rest.reduce((sum, item) => sum + item.ioTokens, 0),
      costUsd: roundCents(rest.reduce((sum, item) => sum + item.costUsd, 0)),
      sessions: rest.reduce((sum, item) => sum + item.sessions.size, 0)
    });
  }
  return rows;
}

// 把会话的工作目录归到项目：子目录并入同一批记录里出现过的上级目录
// （…/JerreaderUnified/iosApp → JerreaderUnified），但主目录和 Documents / Desktop 这类容器目录不当项目。
function createProjectResolver(cwds) {
  const home = os.homedir();
  const containers = new Set([home, ...['Documents', 'Desktop', 'Downloads', 'Developer', 'Projects', 'code']
    .map((name) => path.join(home, name)), '/']);
  const known = [...new Set(cwds.filter((cwd) => typeof cwd === 'string' && cwd))]
    .map((cwd) => cwd.replace(/\/+$/, '') || '/')
    .sort((a, b) => a.length - b.length);
  const cache = new Map();
  return (cwd) => {
    const raw = typeof cwd === 'string' && cwd ? cwd.replace(/\/+$/, '') || '/' : '';
    if (cache.has(raw)) return cache.get(raw);
    let result;
    if (!raw) {
      result = { key: '', name: null };
    } else {
      const root = known.find((candidate) => !containers.has(candidate)
        && candidate !== raw
        && raw.startsWith(`${candidate}/`)) || raw;
      result = { key: root, name: root === home ? '~' : path.basename(root) || root };
    }
    cache.set(raw, result);
    return result;
  };
}

function syncActivityWindows(provider) {
  const isClaude = provider === 'claude';
  const entries = isClaude ? claudeEntriesSnapshot.entries : codexEntriesSnapshot.entries;
  const activity = isClaude ? state.claudeActivity : state.tokenActivity;
  const usage = isClaude ? state.claudeUsage?.data : state.usage?.data;
  if (!Array.isArray(entries) || !activity?.data) return;
  activity.data = {
    ...activity.data,
    windows: buildActivityWindows(entries, usage)
  };
}

function formatLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function refreshClaudeRadar() {
  return refreshStateSlice('claude-radar', 'claudeRadar', async () => {
    try {
      const raw = await fetchJson(CLAUDE_RADAR_URL, { headers: { Referer: CLAUDE_RADAR_HOME } });
      const normalized = normalizeClaudeRadar(raw);
      await cacheRadarData('claude', normalized);
      return normalized;
    } catch (error) {
      if (error.code === 'invalid-json-response' || [404, 410].includes(error.status)) {
        // 数据源下线不是本机故障：带上错误码，渲染层据此显示成「暂不可用」而不是红色报错。
        const unavailable = new Error(tr('errClaudeRadarSourceUnavailable'));
        unavailable.code = 'radar-source-unavailable';
        throw unavailable;
      }
      throw error;
    }
  }, { formatError: (error) => requestErrorMessage(error, 'Claude Radar') });
}

// 官方状态页：只取相关组件；从正常变成部分/严重故障时提醒一次。
function refreshServiceStatus(provider) {
  const page = STATUS_PAGES[provider];
  if (!page) return Promise.resolve(null);
  return refreshStateSlice(`status-${provider}`, `${provider}Status`, async () => {
    const summary = normalizeStatusSummary(await fetchJson(page.url, { requestTimeoutMs: 10_000 }), provider);
    if (!summary) throw new Error(tr('errStatusInvalid'));
    return summary;
  }, {
    formatError: (error) => requestErrorMessage(error, provider === 'claude' ? 'Claude Status' : 'OpenAI Status'),
    onSettled: () => checkServiceStatusAlert(provider)
  });
}

function refreshServiceStatuses() {
  const jobs = [refreshServiceStatus('codex')];
  if (isProviderEnabled('claude', settings.providerSettings)) jobs.push(refreshServiceStatus('claude'));
  return Promise.all(jobs);
}

function checkServiceStatusAlert(provider) {
  const summary = state[`${provider}Status`]?.data;
  if (!summary || state[`${provider}Status`].status !== 'ok') return;
  const previous = alertState.status?.[provider] || 'none';
  alertState.status = { ...(alertState.status || {}), [provider]: summary.level };
  queueAlertStateSave();
  const serious = ['major', 'critical'].includes(summary.level);
  if (!serious || ['major', 'critical'].includes(previous) || !alertsActive()) return;
  const name = provider === 'claude' ? 'Claude' : 'Codex';
  const affected = summary.components.filter((item) => item.level !== 'none').map((item) => item.name);
  const detail = summary.incidents[0]?.name || affected.join(' / ') || summary.pageDescription;
  notify(tr('notifyStatusTitle', { name }), tr('notifyStatusBody', { detail }));
}

function normalizeClaudeRadar(raw) {
  const models = Array.isArray(raw?.iq?.models) ? raw.iq.models : [];
  const items = sortClaudeIqItems(models
    .map((model) => normalizeClaudeIqItem(model))
    .filter(Boolean));
  if (!items.length) throw new Error(tr('errRadarNoMetrics'));
  const quota = raw?.quota || {};

  return {
    updatedAt: raw?.updated_at || null,
    iqUpdatedAt: raw?.iq?.updated_at || null,
    items,
    quota: {
      updatedAt: quota.updated_at || null,
      baseH5: Number.isFinite(Number(quota.base_h5)) ? Number(quota.base_h5) : null,
      baseD7: Number.isFinite(Number(quota.base_d7)) ? Number(quota.base_d7) : null,
      usage: Array.isArray(quota.usage)
        ? quota.usage.map((row) => ({
            key: row?.key || '',
            usedPercent: clamp(Math.round(Number(row?.used_pct) || 0), 0, 100),
            resetText: row?.reset_text_zh || row?.reset_text_en || ''
          }))
        : [],
      chartLabel: quota?.chart?.label_zh || quota?.chart?.label_en || null,
      note: quota?.cal?.note || null
    },
    sourceUrl: CLAUDE_RADAR_HOME
  };
}

function normalizeClaudeIqItem(model) {
  if (!model) return null;
  const name = String(model.name || model.key || '').trim();
  if (!name) return null;
  const effortMatch = name.match(/\s+(xhigh|high|medium|low|minimal|max|ultra)$/i);
  const reasoningEffort = effortMatch ? effortMatch[1].toLowerCase() : '';
  const modelLabel = effortMatch ? name.slice(0, effortMatch.index).trim() : name;
  const iqSeries = Array.isArray(model.iq) ? model.iq : [];
  const passSeries = Array.isArray(model.pass) ? model.pass : [];
  const validSeries = Array.isArray(model.valid) ? model.valid : [];
  const invalidSeries = Array.isArray(model.invalid) ? model.invalid : [];
  const costSeries = Array.isArray(model.cost) ? model.cost : [];
  const timeSeries = Array.isArray(model.time) ? model.time : [];
  let latestIndex = -1;
  for (let index = iqSeries.length - 1; index >= 0; index -= 1) {
    if (iqSeries[index] !== null && iqSeries[index] !== undefined) {
      latestIndex = index;
      break;
    }
  }
  const score = Number(model.score ?? (latestIndex >= 0 ? iqSeries[latestIndex] : NaN));
  const passed = latestIndex >= 0 && Number.isFinite(Number(passSeries[latestIndex]))
    ? Number(passSeries[latestIndex])
    : null;
  const tasks = latestIndex >= 0 && Number.isFinite(Number(validSeries[latestIndex]))
    ? Number(validSeries[latestIndex])
    : null;
  const invalid = latestIndex >= 0 && Number.isFinite(Number(invalidSeries[latestIndex]))
    ? Number(invalidSeries[latestIndex])
    : 0;
  const costUsd = latestIndex >= 0 && Number.isFinite(Number(costSeries[latestIndex]))
    ? Number(costSeries[latestIndex])
    : null;
  const wallHours = latestIndex >= 0 && Number.isFinite(Number(timeSeries[latestIndex]))
    ? Number(timeSeries[latestIndex])
    : null;

  return {
    label: name,
    modelLabel,
    reasoningEffort,
    score: Number.isFinite(score) ? score : null,
    passed,
    tasks,
    invalid,
    costUsd,
    wallHours,
    averageCostUsd: costUsd,
    averageTaskSeconds: Number.isFinite(wallHours) ? wallHours * 3600 : null,
    averageTaskTimeHuman: null,
    sampleCount24h: iqSeries.filter((value) => value !== null && value !== undefined).length || null,
    latestAt: model.latest_at || null,
    status: invalid > 0 ? 'invalid' : claudeIqStatus(score)
  };
}

function sortClaudeIqItems(items) {
  return items.slice().sort((left, right) => {
    const capabilityOrder = claudeModelCapabilityRank(right.modelLabel) - claudeModelCapabilityRank(left.modelLabel);
    if (capabilityOrder !== 0) return capabilityOrder;

    const versionOrder = compareVersionParts(modelVersionParts(right.modelLabel), modelVersionParts(left.modelLabel));
    if (versionOrder !== 0) return versionOrder;

    const effortOrder = reasoningEffortRank(right.reasoningEffort) - reasoningEffortRank(left.reasoningEffort);
    if (effortOrder !== 0) return effortOrder;

    const modelOrder = left.modelLabel.localeCompare(right.modelLabel, 'en', { sensitivity: 'base' });
    if (modelOrder !== 0) return modelOrder;
    return (Date.parse(right.latestAt || '') || 0) - (Date.parse(left.latestAt || '') || 0);
  });
}

function claudeModelCapabilityRank(label) {
  const family = String(label || '').toLowerCase();
  if (family.includes('fable')) return 500;
  if (family.includes('mythos')) return 450;
  if (family.includes('opus')) return 400;
  if (family.includes('sonnet')) return 300;
  if (family.includes('haiku')) return 200;
  return 0;
}

function modelVersionParts(label) {
  const match = String(label || '').match(/\d+(?:\.\d+)*/);
  return match ? match[0].split('.').map((part) => Number(part) || 0) : [];
}

function compareVersionParts(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function reasoningEffortRank(value) {
  const ranks = { ultra: 7, max: 6, xhigh: 5, high: 4, medium: 3, low: 2, minimal: 1 };
  return ranks[String(value || '').toLowerCase()] || 0;
}

function claudeIqStatus(score) {
  if (!Number.isFinite(score)) return 'unknown';
  // 阈值对齐 codexradar 的配色口径（105→绿、90→黄、75→红），两边同一把尺子。
  if (score >= 100) return 'green';
  if (score >= 85) return 'yellow';
  return 'red';
}

// ---- 额度采样：燃烧率预测 / 24h 曲线 / 阈值通知的共同底层 ----

const usageHistory = Object.fromEntries(PROVIDER_IDS.map((id) => [id, []]));
let usageHistorySaveTimer = null;
let usageHistoryCompactedAt = 0;
// 提醒状态落盘：重启后不会对同一个窗口重复提醒。provider → 窗口键 → 记录。
let alertState = { windows: {}, credentials: {}, status: {} };
let alertStateSaveTimer = null;

async function loadUsageHistory() {
  try {
    const raw = JSON.parse(await fs.readFile(USAGE_HISTORY_PATH, 'utf8'));
    const cutoff = Date.now() - USAGE_HISTORY_RETENTION_MS;
    for (const provider of PROVIDER_IDS) {
      if (Array.isArray(raw?.[provider])) {
        usageHistory[provider] = raw[provider]
          .filter((s) => Number(s?.t) > cutoff)
          .sort((a, b) => a.t - b.t);
      }
    }
    compactUsageHistory();
  } catch {
    // 首次运行没有历史文件，正常。
  }
  for (const provider of PROVIDER_IDS) refreshUsageHistoryView(provider);
}

function queueUsageHistorySave() {
  if (usageHistorySaveTimer) return;
  usageHistorySaveTimer = setTimeout(() => {
    usageHistorySaveTimer = null;
    fs.writeFile(USAGE_HISTORY_PATH, JSON.stringify(usageHistory), 'utf8').catch(() => {});
  }, 30_000);
}

// 超过 24 小时的样本压成 15 分钟一个（保留重置前的峰值），这样能留 30 天而文件不膨胀。
function compactUsageHistory(now = Date.now()) {
  usageHistoryCompactedAt = now;
  const boundary = now - USAGE_HISTORY_RAW_MS;
  for (const provider of PROVIDER_IDS) {
    const list = usageHistory[provider];
    const splitAt = list.findIndex((sample) => sample.t >= boundary);
    const older = splitAt === -1 ? list : list.slice(0, splitAt);
    if (older.length < 2) continue;
    const recent = splitAt === -1 ? [] : list.slice(splitAt);
    usageHistory[provider] = [...pace.compactSamples(older, USAGE_HISTORY_COMPACT_BUCKET_MS, ['five', 'week']), ...recent];
  }
}

function extraSampleValues(usage) {
  const used = {};
  const resets = {};
  for (const extra of Array.isArray(usage?.extraWindows) ? usage.extraWindows : []) {
    if (!extra?.name || extra.inactive || !Number.isFinite(extra.usedPercent)) continue;
    used[extra.name] = extra.usedPercent;
    if (extra.resetAt) resets[extra.name] = extra.resetAt;
  }
  return Object.keys(used).length ? { ex: used, exr: resets } : {};
}

function recordUsageSample(provider) {
  const slice = provider === 'codex' ? state.usage : state[`${provider}Usage`];
  checkCredentialAlerts(provider, slice);
  if (slice.status !== 'ok' || !slice.data) return;
  const usage = slice.data;
  const now = Date.now();
  const sample = {
    t: now,
    five: Number.isFinite(usage.primaryWindow?.usedPercent) ? usage.primaryWindow.usedPercent : null,
    week: Number.isFinite(usage.secondaryWindow?.usedPercent) ? usage.secondaryWindow.usedPercent : null,
    fiveReset: usage.primaryWindow?.resetAt || null,
    weekReset: usage.secondaryWindow?.resetAt || null,
    ...extraSampleValues(usage)
  };
  const list = usageHistory[provider];
  list.push(sample);
  const cutoff = now - USAGE_HISTORY_RETENTION_MS;
  while (list.length && list[0].t < cutoff) list.shift();
  if (now - usageHistoryCompactedAt > 3600_000) compactUsageHistory(now);
  refreshUsageHistoryView(provider);
  checkUsageAlerts(provider, usage);
  queueUsageHistorySave();
}

function historyPoint(sample) {
  const point = { t: sample.t, five: sample.five, week: sample.week };
  if (sample.ex) point.ex = sample.ex;
  return point;
}

function refreshUsageHistoryView(provider) {
  const now = Date.now();
  const cutoff = now - USAGE_HISTORY_VIEW_MS;
  const all = usageHistory[provider] || [];
  const recent = all.filter((s) => s.t >= cutoff);
  // IPC 只发近 24 小时并抽稀到 ≤200 个点，别把整份历史塞给渲染层。
  const step = Math.max(1, Math.ceil(recent.length / USAGE_HISTORY_VIEW_POINTS));
  const view = recent.filter((_, index) => index % step === 0 || index === recent.length - 1);
  state.usageHistory[provider] = view.map(historyPoint);
  // 7 天视图：按小时压缩（重置前峰值保留），约 170–200 个点。
  const weekCutoff = now - USAGE_HISTORY_WEEK_VIEW_MS;
  const weekSamples = all.filter((s) => s.t >= weekCutoff);
  state.usageHistoryWeek[provider] = pace.compactSamples(weekSamples, 3600_000, ['five', 'week']).map(historyPoint);
}

async function loadAlertState() {
  try {
    const raw = JSON.parse(await fs.readFile(ALERT_STATE_PATH, 'utf8'));
    alertState = {
      windows: raw?.windows && typeof raw.windows === 'object' ? raw.windows : {},
      credentials: raw?.credentials && typeof raw.credentials === 'object' ? raw.credentials : {},
      status: raw?.status && typeof raw.status === 'object' ? raw.status : {}
    };
  } catch {
    alertState = { windows: {}, credentials: {}, status: {} };
  }
}

function queueAlertStateSave() {
  if (alertStateSaveTimer) return;
  alertStateSaveTimer = setTimeout(() => {
    alertStateSaveTimer = null;
    fs.writeFile(ALERT_STATE_PATH, JSON.stringify(alertState), 'utf8').catch(() => {});
  }, 2_000);
}

function isSameAlertWindow(a, b) {
  return Boolean(a && b && Math.abs(a - b) <= ALERT_SAME_WINDOW_MS);
}

function alertTracker(provider, key) {
  const byProvider = alertState.windows[provider] || (alertState.windows[provider] = {});
  return byProvider[key] || (byProvider[key] = { resetAt: null, lastUsed: null, fired: [], paceFor: null, nearCap: false });
}

function alertWindowLabel(entry) {
  if (entry.key === 'five') return tr('windowName5h');
  if (entry.key === 'week') return tr('windowNameWeek');
  return tr('windowNameScoped', { name: entry.name || '' });
}

function alertsActive() {
  return settings.notificationsEnabled && (Notification.isSupported() || Boolean(settings.webhookUrl));
}

function checkUsageAlerts(provider, usage) {
  const now = Date.now();
  const name = PROVIDER_BY_ID[provider]?.label || provider;
  const thresholds = alertThresholdList();
  const active = alertsActive();
  for (const entry of pace.listWindows(usage, { provider, now })) {
    const tracker = alertTracker(provider, entry.key);
    const used = Number(entry.window.usedPercent);
    if (!Number.isFinite(used)) continue;
    const resetAt = Number(entry.window.resetAt) || null;
    const label = alertWindowLabel(entry);

    // 新窗口：resetAt 明显往后挪了，或用量大幅回落。
    const movedOn = tracker.resetAt && resetAt && resetAt - tracker.resetAt > ALERT_SAME_WINDOW_MS;
    const dropped = Number.isFinite(tracker.lastUsed) && tracker.lastUsed - used >= 30;
    if (movedOn || dropped) {
      if (tracker.nearCap && active) {
        notify(tr('notifyResetTitle', { name }), tr('notifyResetBody', { name, window: label }));
      }
      tracker.fired = [];
      tracker.paceFor = null;
      tracker.nearCap = false;
    }
    if (resetAt) tracker.resetAt = resetAt;
    tracker.lastUsed = used;
    if (used >= 85) tracker.nearCap = true;

    const remaining = Math.max(0, 100 - used);
    const crossed = thresholds.filter((threshold) => remaining <= threshold);
    if (crossed.length) {
      const lowest = crossed[crossed.length - 1];
      if (!tracker.fired.includes(lowest)) {
        if (active) {
          const resetText = resetAt ? formatAlertTime(resetAt) : '--';
          if (remaining <= 0) {
            notify(
              tr('notifyExhaustedTitle', { name, window: label }),
              tr('notifyExhaustedBody', { window: label, time: resetText })
            );
          } else {
            notify(
              tr('notifyLowTitle', { name, window: label }),
              tr('notifyLowBody', { name, window: label, remaining })
            );
          }
        }
        tracker.fired = crossed;
      }
    } else if (tracker.fired.length && remaining > (thresholds[0] ?? 0) + 5) {
      tracker.fired = [];
    }

    // 预测型：按窗口内平均速度会在重置前用尽，而且提前量不小（≥ 窗口的 10%）。每个窗口只提醒一次。
    const p = entry.pace;
    if (
      settings.paceAlertsEnabled
      && p?.ready
      && p.tier === 'serious'
      && p.lastsUntilReset === false
      && p.elapsedPercent >= 15
      && used >= 25
      && remaining > (thresholds[0] ?? 0)
      && p.earlyByMs >= (entry.durationMs || 0) * 0.1
      // 不能用 !== 比较：resetAt 每次拉取都有抖动，全等判断会让条件持续满足时每次拉取都再提醒一次。
      && resetAt
      && !isSameAlertWindow(tracker.paceFor, resetAt)
    ) {
      tracker.paceFor = resetAt;
      if (active) {
        notify(
          tr('notifyPaceTitle', { name, window: label }),
          tr('notifyPaceBody', {
            window: label,
            used: Math.round(used),
            elapsed: Math.round(p.elapsedPercent),
            time: formatAlertTime(p.runOutAt),
            early: formatAlertDuration(p.earlyByMs)
          })
        );
      }
    }
  }
  queueAlertStateSave();
}

// 凭据失效（Claude CLI 登录过期 / Codex 401）只提醒一次，恢复后清掉标记。
function checkCredentialAlerts(provider, slice) {
  if (provider !== 'codex' && provider !== 'claude') return;
  const expired = provider === 'claude'
    ? slice.status === 'error' && CLAUDE_RECONNECT_CODES.has(slice.errorCode)
    : slice.status === 'error' && slice.errorCode === 'http-401';
  if (slice.status === 'ok') {
    if (alertState.credentials[provider]) {
      alertState.credentials[provider] = false;
      queueAlertStateSave();
    }
    return;
  }
  if (!expired || alertState.credentials[provider]) return;
  alertState.credentials[provider] = true;
  queueAlertStateSave();
  if (!alertsActive()) return;
  const name = PROVIDER_BY_ID[provider]?.label || provider;
  notify(
    tr('notifyCredentialTitle', { name }),
    provider === 'claude' ? tr('notifyCredentialBodyClaude', { command: CLAUDE_LOGIN_COMMAND }) : tr('notifyCredentialBodyCodex')
  );
}

function formatAlertTime(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '--';
  const sameDay = new Date().toDateString() === date.toDateString();
  return new Intl.DateTimeFormat(settings.language, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatAlertDuration(ms) {
  const minutes = Math.max(1, Math.round(Number(ms) / 60_000));
  if (minutes < 60) return tr('durationMinutes', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return tr('durationHours', { n: hours });
  return tr('durationDays', { n: Math.round(hours / 24) });
}

// 通知对象被回收后点击就没反应了，显示期间保留引用。
const activeNotifications = new Set();

function notify(title, body, { webhook = true } = {}) {
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({ title, body, silent: false });
      const release = () => activeNotifications.delete(notification);
      activeNotifications.add(notification);
      notification.on('click', () => {
        release();
        revealPanel();
      });
      notification.on('close', release);
      notification.on('failed', release);
      notification.show();
      // 通知中心里留存的通知可能很久之后才被点，兜底释放避免一直累积。
      setTimeout(release, 6 * 60 * 60 * 1000).unref?.();
    }
  } catch {
    // 通知失败不影响主流程。
  }
  if (webhook && settings.webhookUrl) {
    sendWebhook(settings.webhookUrl, title, body).catch(() => {});
  }
}

async function sendWebhook(rawUrl, title, body) {
  const request = buildWebhookRequest(rawUrl, title, body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const response = await net.fetch(request.url, {
      method: 'POST',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': `CodexMenuMeter/${app.getVersion()}`
      },
      body: request.body
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return { ok: true, kind: request.kind };
  } finally {
    clearTimeout(timer);
  }
}

async function testWebhook(rawUrl) {
  const url = normalizeWebhookUrl(rawUrl ?? settings.webhookUrl);
  if (!url) throw new Error(tr('webhookInvalid'));
  try {
    return await sendWebhook(url, tr('webhookTestTitle'), tr('webhookTestBody'));
  } catch (error) {
    throw new Error(requestErrorMessage(error, 'Webhook'));
  }
}

// ---- 全局快捷键 ----

function applyPanelHotkey() {
  globalShortcut.unregister(PANEL_HOTKEY);
  if (!settings.hotkeyEnabled) return;
  try {
    globalShortcut.register(PANEL_HOTKEY, togglePanel);
  } catch {
    // 快捷键被占用时静默失败。
  }
}

function enabledExtraIds() {
  return EXTRA_PROVIDER_IDS.filter((id) => settings.providerSettings[id]?.enabled);
}

function extraApiKey(id) {
  const configured = settings.providerSettings[id]?.apiKey;
  if (configured) return configured;
  for (const envKey of EXTRA_PROVIDER_META[id].envKeys) {
    if (process.env[envKey]) return process.env[envKey];
  }
  return null;
}

function extraError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function refreshExtraUsage(id) {
  return refreshStateSlice(`extra-${id}`, `${id}Usage`, () => readExtraUsage(id), {
    formatError: (error) => extraUsageErrorMessage(id, error),
    onSettled: () => {
      updateTrayTitle();
      recordUsageSample(id);
      scheduleResetRefresh();
    }
  });
}

function refreshEnabledExtras() {
  return Promise.all(enabledExtraIds().map((id) => refreshExtraUsage(id)));
}

async function readExtraUsage(id) {
  if (id === 'kimi') return readKimiUsage();
  if (id === 'glm') return readGlmUsage();
  // Qwen Coding Plan 官方只提供控制台页面，没有额度查询接口。
  throw extraError('qwen-no-api');
}

function extraUsageErrorMessage(id, error) {
  if (error?.code === 'no-api-key') return tr('errNoApiKey');
  if (error?.code === 'qwen-no-api') return tr('errQwenNoApi');
  return requestErrorMessage(error, EXTRA_PROVIDER_META[id].name);
}

async function readKimiUsage() {
  const apiKey = extraApiKey('kimi');
  if (!apiKey) throw extraError('no-api-key');
  const headers = { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'KimiCLI/1.6' };
  let raw;
  try {
    raw = await fetchJson(`${KIMI_USAGE_BASE}/usages`, { headers });
  } catch (error) {
    if (error?.status !== 404) throw error;
    raw = await fetchJson(`${KIMI_USAGE_BASE}/usage`, { headers });
  }
  const usage = normalizeKimiUsage(raw);
  if (!usage) throw extraError('bad-data');
  return usage;
}

function normalizeKimiUsage(raw) {
  let summary = null;
  const limitEntries = [];
  if (Array.isArray(raw?.data)) {
    for (const item of raw.data) {
      if (!item || typeof item !== 'object') continue;
      if (item.model_name === 'all') summary = summary || item;
      else limitEntries.push({ detail: item, window: item.window || {} });
    }
  } else {
    if (raw?.usage && typeof raw.usage === 'object') summary = raw.usage;
    if (Array.isArray(raw?.limits)) {
      for (const item of raw.limits) {
        if (!item || typeof item !== 'object') continue;
        limitEntries.push({
          detail: item.detail && typeof item.detail === 'object' ? item.detail : item,
          window: item.window && typeof item.window === 'object' ? item.window : {}
        });
      }
    }
  }

  // Kimi 的汇总（model_name=all）是周用量，映射到周卡；5 小时类窗口映射到 5h 卡。
  const secondaryWindow = countBasedWindow(summary);
  let primaryWindow = null;
  const extraWindows = [];
  for (const { detail, window } of limitEntries) {
    const normalized = countBasedWindow(detail);
    if (!normalized) continue;
    if (!primaryWindow && isFiveHourWindow(window)) primaryWindow = normalized;
    else extraWindows.push({ ...normalized, name: kimiWindowName(window, detail) });
  }

  if (!primaryWindow && !secondaryWindow && !extraWindows.length) return null;
  return {
    planType: null,
    limitReached: [primaryWindow, secondaryWindow, ...extraWindows].some((item) => item && item.usedPercent >= 100),
    primaryWindow,
    secondaryWindow,
    extraWindows
  };
}

function countBasedWindow(detail) {
  if (!detail || typeof detail !== 'object') return null;
  const limit = Number(detail.limit ?? detail.limit_amount);
  let used = Number(detail.used ?? detail.used_amount);
  const remaining = Number(detail.remaining);
  if (!Number.isFinite(used) && Number.isFinite(remaining) && Number.isFinite(limit)) used = limit - remaining;
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(used)) return null;
  const usedPercent = clamp(Math.round((used / limit) * 100), 0, 100);
  let resetAt = parseClaudeTimestamp(detail.resetTime ?? detail.reset_at ?? detail.reset_time);
  if (!resetAt && Number.isFinite(Number(detail.reset_in))) {
    resetAt = Date.now() + Number(detail.reset_in) * 1000;
  }
  return { usedPercent, remainingPercent: clamp(100 - usedPercent, 0, 100), resetAt };
}

function windowSpanMinutes(window) {
  const duration = Number(window?.duration);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const unit = String(window?.timeUnit || window?.time_unit || '').toUpperCase();
  if (unit.includes('MINUTE')) return duration;
  if (unit.includes('HOUR')) return duration * 60;
  if (unit.includes('DAY')) return duration * 1440;
  if (unit.includes('MONTH')) return duration * 43_200;
  return null;
}

function isFiveHourWindow(window) {
  return windowSpanMinutes(window) === 300;
}

function kimiWindowName(window, detail) {
  const named = String(detail?.name || detail?.title || '').trim();
  if (named) return named;
  const minutes = windowSpanMinutes(window);
  if (!minutes) return 'Limit';
  if (minutes % 43_200 === 0) return `${minutes / 43_200}mo`;
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

let glmQuotaUrlIndex = 0;

async function readGlmUsage() {
  const apiKey = extraApiKey('glm');
  if (!apiKey) throw extraError('no-api-key');
  // 智谱的额度接口直接把 API Key 放 Authorization（无 Bearer 前缀），国内/国际站路径相同。
  const headers = { Authorization: apiKey };
  const first = GLM_QUOTA_URLS[glmQuotaUrlIndex];
  const second = GLM_QUOTA_URLS[1 - glmQuotaUrlIndex];
  let raw;
  try {
    raw = await fetchJson(first, { headers });
  } catch (error) {
    try {
      raw = await fetchJson(second, { headers });
      glmQuotaUrlIndex = 1 - glmQuotaUrlIndex;
    } catch {
      throw error;
    }
  }
  const usage = normalizeGlmUsage(raw);
  if (!usage) throw extraError('bad-data');
  return usage;
}

function normalizeGlmUsage(raw) {
  const limits = Array.isArray(raw?.data?.limits)
    ? raw.data.limits
    : Array.isArray(raw?.limits)
      ? raw.limits
      : [];
  const tokenLimits = limits.filter((item) => item?.type === 'TOKENS_LIMIT');
  // number=5 的 TOKENS_LIMIT 是 5 小时窗，另一个是周窗，与 Codex/Claude 的双窗结构一致。
  const fiveHour = tokenLimits.find((item) => Number(item?.number) === 5) || null;
  const weekly = tokenLimits.find((item) => item !== fiveHour) || null;
  const mcp = limits.find((item) => item?.type === 'MCP_LIMIT' || item?.type === 'TIME_LIMIT') || null;

  const primaryWindow = glmWindow(fiveHour);
  const secondaryWindow = glmWindow(weekly);
  const extraWindows = [];
  const mcpWindow = glmWindow(mcp);
  if (mcpWindow) extraWindows.push({ ...mcpWindow, name: 'MCP' });

  if (!primaryWindow && !secondaryWindow && !extraWindows.length) return null;
  return {
    planType: null,
    limitReached: [primaryWindow, secondaryWindow, ...extraWindows].some((item) => item && item.usedPercent >= 100),
    primaryWindow,
    secondaryWindow,
    extraWindows
  };
}

function glmWindow(limit) {
  if (!limit || typeof limit !== 'object') return null;
  const usedPercent = glmUsedPercent(limit);
  if (usedPercent === null) return null;
  return {
    usedPercent,
    remainingPercent: clamp(100 - usedPercent, 0, 100),
    resetAt: parseClaudeTimestamp(limit.nextResetTime)
  };
}

function glmUsedPercent(limit) {
  const remaining = toFiniteNumber(limit.remaining);
  const current = toFiniteNumber(limit.currentValue);
  const usage = toFiniteNumber(limit.usage);
  const totalFromParts = remaining !== null && current !== null ? remaining + current : null;
  const total = totalFromParts !== null && totalFromParts > 0
    ? totalFromParts
    : usage !== null && usage > 0
      ? usage
      : null;
  if (total !== null) {
    if (remaining !== null && remaining >= 0 && remaining <= total) {
      return clamp(Math.round(100 - (remaining / total) * 100), 0, 100);
    }
    if (current !== null && current >= 0 && current <= total) {
      return clamp(Math.round((current / total) * 100), 0, 100);
    }
  }
  const percentage = toFiniteNumber(limit.percentage);
  return percentage === null ? null : clamp(Math.round(percentage), 0, 100);
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function updateTrayTitle() {
  if (!tray) return;
  if (EXTRA_PROVIDER_IDS.includes(state.provider)) {
    const meta = EXTRA_PROVIDER_META[state.provider];
    const usage = state[`${state.provider}Usage`].data;
    const parts = [];
    const primary = usage?.primaryWindow?.remainingPercent;
    const secondary = usage?.secondaryWindow?.remainingPercent;
    if (Number.isFinite(primary)) parts.push(tr('trayFive', { p: `${primary}%` }));
    if (Number.isFinite(secondary)) parts.push(tr('trayWeek', { p: `${secondary}%` }));
    const title = parts.length ? `${meta.tag} ${parts.join('  ')}` : `${meta.tag} --`;
    tray.setTitle(title);
    tray.setToolTip(title);
    return;
  }
  const isClaude = state.provider === 'claude';
  const usage = isClaude ? state.claudeUsage.data : state.usage.data;
  const primary = usage?.primaryWindow?.remainingPercent;
  const secondary = usage?.secondaryWindow?.remainingPercent;
  const primaryText = usage?.fiveHourUnlimited ? '∞' : Number.isFinite(primary) ? `${primary}%` : '--';
  const secondaryText = Number.isFinite(secondary) ? `${secondary}%` : '--';
  tray.setTitle(tr(isClaude ? 'trayClaude' : 'trayCodex', { p: primaryText, s: secondaryText }));
  tray.setToolTip(createTrayTooltip(usage, isClaude));
}

function createTrayTooltip(usage, isClaude) {
  const limit = usage?.limitReached ? tr('trayTipLimit') : '';
  if (usage?.fiveHourUnlimited) {
    return tr('trayTipCodexUnlimited', { s: usage.secondaryWindow?.remainingPercent ?? '--', limit });
  }
  if (!usage?.primaryWindow) return tr(isClaude ? 'trayTipLoadingClaude' : 'trayTipLoadingCodex');
  return tr(isClaude ? 'trayTipClaude' : 'trayTipCodex', {
    p: usage.primaryWindow.remainingPercent,
    s: usage.secondaryWindow?.remainingPercent ?? '--',
    limit
  });
}

async function getTouchBarHelperPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'touchbar-helper'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'native', 'touchbar-helper'),
    path.join(__dirname, '..', 'native', 'touchbar-helper')
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next known packaging layout.
    }
  }

  return null;
}

async function ensureTouchBarHelper() {
  if (process.platform !== 'darwin') return;
  if (process.env.CMM_DISABLE_TOUCHBAR === '1') return;
  if (touchBarHelper && !touchBarHelper.killed) return;

  const helperPath = await getTouchBarHelperPath();
  if (!helperPath) {
    touchBarLog('helper not found');
    return;
  }

  touchBarHelper = spawn(helperPath, [TOUCHBAR_STATE_PATH, String(process.pid)], {
    stdio: ['pipe', 'pipe', 'ignore'],
    detached: false
  });
  touchBarHelperOutput = '';
  touchBarHelper.stdout?.setEncoding('utf8');
  touchBarHelper.stdout?.on('data', handleTouchBarHelperOutput);
  touchBarLog(`started ${helperPath} pid=${touchBarHelper.pid || 'unknown'}`);
  touchBarHelper.on('error', (error) => {
    touchBarLog(`spawn error: ${error.message}`);
    touchBarHelper = null;
  });
  touchBarHelper.on('exit', () => {
    touchBarLog('helper exited');
    touchBarHelperOutput = '';
    touchBarHelper = null;
  });
  touchBarHelper.unref();
}

async function requestTouchBarPresentation() {
  if (process.platform !== 'darwin' || process.env.CMM_DISABLE_TOUCHBAR === '1') return;
  touchBarPresentPending = true;
  try {
    await ensureTouchBarHelper();
    const helper = touchBarHelper;
    if (!touchBarPresentPending || !helper?.stdin?.writable) return;
    helper.stdin.write('present\n');
    touchBarPresentPending = false;
  } catch {
    // Touch Bar support is optional; retry on the next panel opening.
  }
}

function handleTouchBarHelperOutput(chunk) {
  touchBarHelperOutput += String(chunk || '');
  const lines = touchBarHelperOutput.split('\n');
  touchBarHelperOutput = lines.pop() || '';
  for (const line of lines) {
    const message = line.trim();
    if (message === 'pointer-down') handleGlobalPointerDown();
    // 点 Touch Bar 上的额度块：打开面板（已经开着就不动）并刷新当前平台，和面板里的刷新按钮走同一条路。
    if (message === 'touchbar-open-panel') {
      touchBarLog(message);
      revealPanel();
      refreshProvider(state.provider).catch((error) => touchBarLog(`refresh failed: ${error.message}`));
    }
    if (message.startsWith('touchbar-provider:')) {
      touchBarLog(message);
      selectProvider(message.slice('touchbar-provider:'.length), { source: 'manual' }).catch((error) => {
        touchBarLog(`provider sync failed: ${error.message}`);
      });
    }
    if (message.startsWith('foreground-app:')) {
      const [bundleId = '', name = '', bundlePath = '', pid = ''] = message
        .slice('foreground-app:'.length)
        .split('\t');
      handleForegroundApplication({ bundleId, name, bundlePath, pid });
    }
  }
}

// Touch Bar、通知点击等「打开面板」入口：已经开着就不动，正在关闭则撤销关闭。
function revealPanel() {
  if (!panel || panel.isDestroyed()) createPanel();
  if (panelClosing || !panel.isVisible()) showPanelAnimated();
}

function handleForegroundApplication(identity) {
  foregroundProviderTracker.update(identity);
  applyForegroundProvider();
}

function applyForegroundProvider() {
  if (!settings.autoSwitchProvider) return;
  const provider = foregroundProviderTracker.recommendedProvider();
  if (!provider || !isProviderEnabled(provider, settings.providerSettings)) return;
  if (provider === state.provider) return;
  touchBarLog(`foreground-provider:${provider}`);
  selectProvider(provider, { source: 'foreground' }).catch((error) => {
    touchBarLog(`foreground sync failed: ${error.message}`);
  });
}

function handleGlobalPointerDown() {
  if (!panel || panel.isDestroyed() || !panel.isVisible()) return;
  if (Date.now() - panelShownAt < POINTER_OPEN_GRACE_MS) return;
  const cursor = screen.getCursorScreenPoint();
  if (isPointInsideBounds(cursor, panel.getBounds(), PANEL_HOVER_PADDING)) return;
  const trayBounds = tray?.getBounds();
  if (trayBounds && isPointInsideBounds(cursor, trayBounds, 2)) return;
  hidePanelAnimated();
}

function stopTouchBarHelper() {
  touchBarPresentPending = false;
  if (!touchBarHelper || touchBarHelper.killed) return;
  touchBarHelper.kill();
  touchBarHelper = null;
}

function queueTouchBarStateWrite() {
  if (process.platform !== 'darwin') return;
  if (touchBarStateTimer) clearTimeout(touchBarStateTimer);
  touchBarStateTimer = setTimeout(() => {
    touchBarStateTimer = null;
    writeTouchBarState();
  }, 80);
}

function touchBarLog(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.mkdir(path.dirname(TOUCHBAR_LOG_PATH), { recursive: true })
    .then(() => fs.appendFile(TOUCHBAR_LOG_PATH, line, 'utf8'))
    .catch(() => {});
}

let lastTouchBarSignature = null;

async function writeTouchBarState() {
  try {
    const payload = createTouchBarPayload();
    // updatedAt 每次都变，比较时剔除，内容没变就不写盘，减少无谓的磁盘唤醒。
    const signature = JSON.stringify({ ...payload, updatedAt: null });
    if (signature !== lastTouchBarSignature) {
      lastTouchBarSignature = signature;
      await fs.mkdir(path.dirname(TOUCHBAR_STATE_PATH), { recursive: true });
      await fs.writeFile(TOUCHBAR_STATE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    }
    await ensureTouchBarHelper();
  } catch {
    // Touch Bar support is optional; the menu-bar app should keep running if this fails.
  }
}

function createTouchBarPayload() {
  const providers = Object.fromEntries(state.enabledProviders.map((provider) => {
    const meta = PROVIDER_BY_ID[provider];
    if (provider === 'codex') {
      return [provider, createTouchBarProviderPayload(
        meta.tag,
        state.usage.data,
        state.radar.data?.modelIq?.items || [],
        provider
      )];
    }
    if (provider === 'claude') {
      return [provider, createTouchBarProviderPayload(
        meta.tag,
        state.claudeUsage.data,
        state.claudeRadar.data?.items || [],
        provider
      )];
    }
    return [provider, createTouchBarProviderPayload(
      meta.tag,
      state[`${provider}Usage`]?.data,
      [],
      provider
    )];
  }));

  return {
    updatedAt: Date.now(),
    preferredProvider: state.provider,
    providerOrder: state.enabledProviders,
    providers
  };
}

function createTouchBarProviderPayload(label, usage, iqItems, provider) {
  const latestItems = provider === 'codex' ? mergeCatalogItems(iqItems, codexModelCatalog) : [];
  const newestModels = [...new Set(latestItems.filter((item) => item.isLatest).map((item) => item.modelLabel))]
    .sort(compareModelVersions).slice(0, 3);
  const firstPage = newestModels.map((modelLabel) => latestItems.find((item) => item.modelLabel === modelLabel && item.reasoningEffort === 'max')
    || latestItems.find((item) => item.modelLabel === modelLabel)).filter(Boolean);
  const secondPage = [['sol', 'medium'], ['terra', 'max'], ['luna', 'max']]
    .map(([family, effort]) => latestFamilyItem(latestItems, family, effort)).filter(Boolean);
  const displayItems = provider === 'codex'
    ? [...firstPage, ...secondPage]
    : iqItems.slice().sort((a, b) => compareModelVersions(a.modelLabel, b.modelLabel)).slice(0, 6);

  return {
    label,
    usage: {
      five: usage?.fiveHourUnlimited
        ? { label: '5h', remainingPercent: null, resetAt: null, unlimited: true }
        : touchBarQuota('5h', usage?.primaryWindow, { key: 'five', provider }),
      week: touchBarQuota('7d', usage?.secondaryWindow, { key: 'week', provider }),
      // 带名称的附加限额（Claude 的 Fable 周限额、GLM 的 MCP 等）。没有 IQ 数据时 Touch Bar 给它们各画一块。
      extra: (usage?.extraWindows || [])
        .filter((item) => String(item?.name || '').trim())
        .slice(0, 2)
        .map((item) => touchBarQuota(String(item.name).trim().slice(0, 10), item, { key: `extra:${String(item.name).trim()}`, provider }))
    },
    iq: displayItems.map((item) => ({
      label: item.label,
      compactLabel: compactTouchLabel(item.modelLabel || item.label, item.reasoningEffort, provider),
      score: finiteNumber(item.score),
      status: item.status || 'unknown'
    }))
  };
}

// tier / status 来自 usage-pace.js，Touch Bar 按 tier 上色；匀速刻度的位置随时间走，
// 由 helper 用 resetAt 和 windowMs 每半分钟自己算（状态文件只在数据变化时才重写）。
// 节奏只给 GPT / Claude：附加平台的窗口长度不固定。
function touchBarQuota(label, windowValue, { key = null, provider = '' } = {}) {
  const remaining = Number(windowValue?.remainingPercent);
  const quota = {
    label,
    remainingPercent: Number.isFinite(remaining) ? clamp(Math.round(remaining), 0, 100) : null,
    resetAt: Number.isFinite(Number(windowValue?.resetAt)) ? Number(windowValue.resetAt) : null
  };
  if (key && windowValue && !windowValue.inactive && (provider === 'codex' || provider === 'claude')) {
    const windowMs = pace.windowDurationMs(key, provider);
    const info = pace.computePace(windowValue, { durationMs: windowMs });
    if (info) {
      // 刚开窗时节奏还算不出来（tier 只是占位的 good），重置 / 未知状态也没有节奏：这些情况不给 tier，
      // Touch Bar 就按剩余百分比的老规则上色，免得新一周头几个小时用掉一大半还显示绿色。
      if (info.ready || info.tier === 'critical') quota.tier = info.tier;
      quota.status = info.status;
      if (windowMs) quota.windowMs = windowMs;
    }
  }
  return quota;
}

function compactTouchLabel(modelLabel, reasoningEffort, provider = 'codex') {
  const label = String(modelLabel || 'Model').trim();
  const effort = compactReasoningEffort(reasoningEffort);
  if (provider === 'claude') {
    const match = label.match(/^(Fable|Mythos|Opus|Sonnet|Haiku)\s*(\d+(?:\.\d+)*)?/i);
    if (!match) return [label.slice(0, 7), effort].filter(Boolean).join('·');
    const family = {
      fable: 'Fab',
      mythos: 'Myt',
      opus: 'Op',
      sonnet: 'Son',
      haiku: 'Hai'
    }[match[1].toLowerCase()] || match[1].slice(0, 3);
    return [family, match[2], effort].filter(Boolean).join('·');
  }

  const match = label.match(/^GPT-(\d+(?:\.\d+)*)(?:\s+(.+))?$/i);
  if (!match) return [label.slice(0, 7), effort].filter(Boolean).join('·');

  const version = match[1];
  const variant = String(match[2] || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.length > 3 ? part.slice(0, 3) : part)
    .join('');
  return [version, variant, effort].filter(Boolean).join('·');
}

function compactReasoningEffort(value) {
  const effort = String(value || '').toLowerCase();
  const known = { ultra: 'U', max: 'MA', xhigh: 'XH', high: 'H', medium: 'M', low: 'L', minimal: 'MIN' };
  return known[effort] || effort.slice(0, 2).toUpperCase();
}

function createTransparentTrayImage() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="18"><rect width="1" height="18" fill="#000" opacity="0.001"/></svg>';
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

// 一次平台切换会连着触发 7 次 sendState（保存设置 + 三个 slice 各进出一次）。
// 合并成一帧一次，渲染层就不会在切换动画里被连续重绘七遍。
function sendState() {
  if (sendStateTimer) return;
  sendStateTimer = setTimeout(flushState, SEND_STATE_COALESCE_MS);
  sendStateTimer.unref?.();
}

function flushState() {
  if (sendStateTimer) {
    clearTimeout(sendStateTimer);
    sendStateTimer = null;
  }
  queueTouchBarStateWrite();
  queueCloudSyncPush();
  mobileServer?.broadcast(state);
  if (panel && !panel.isDestroyed()) {
    panel.webContents.send('state:update', state);
  }
}

function refreshProvider(provider) {
  if (EXTRA_PROVIDER_IDS.includes(provider)) {
    return refreshExtraUsage(provider);
  }
  if (provider === 'claude') {
    return Promise.all([refreshClaudeUsage(), refreshClaudeRadar(), refreshClaudeActivity()]);
  }
  return Promise.all([refreshUsage(), refreshRadar(), refreshTokenActivity()]);
}

async function selectProvider(provider, { source = 'manual' } = {}) {
  if (source === 'manual') foregroundProviderTracker.markManualOverride();
  if (!isProviderEnabled(provider, settings.providerSettings)) return state;
  if (provider === state.provider) return state;

  await saveSettings({ provider });
  if (provider === 'claude') invalidateClaudeEntrySnapshot();
  if (provider === 'codex') invalidateCodexEntrySnapshot();
  refreshProvider(provider).catch(() => {});
  return state;
}

// 手机端和云同步快照里始终带着所有已启用平台的数据，所以只要开了其中之一，
// 就不能只刷新桌面当前选中的那个平台的 Token 活动，否则远端会一直看到空数据。
function mirrorsAllProviders() {
  return Boolean(settings.mobileEnabled || settings.cloudSyncEnabled);
}

function refreshActivities() {
  const mirrorAll = mirrorsAllProviders();
  const jobs = [];
  if (isProviderEnabled('claude', settings.providerSettings) && (mirrorAll || state.provider === 'claude')) {
    jobs.push(refreshClaudeActivity());
  }
  // 附加平台（Kimi/GLM/Qwen）没有本地 Token 记录，只有远端快照需要时才连带刷 Codex。
  if (mirrorAll || (state.provider !== 'claude' && !EXTRA_PROVIDER_IDS.includes(state.provider))) {
    jobs.push(refreshTokenActivity());
  }
  return jobs;
}

function refreshAll() {
  const jobs = [refreshUsage(), refreshRadar(), refreshEnabledExtras(), refreshServiceStatuses()];
  if (isProviderEnabled('claude', settings.providerSettings)) {
    jobs.push(refreshClaudeUsage(), refreshClaudeRadar());
  }
  jobs.push(...refreshActivities());
  return Promise.all(jobs);
}

function refreshAllForRemote() {
  const jobs = [
    refreshServiceStatuses(),
    refreshUsage(),
    refreshRadar(),
    refreshTokenActivity(),
    refreshEnabledExtras()
  ];
  if (isProviderEnabled('claude', settings.providerSettings)) {
    jobs.push(refreshClaudeUsage(), refreshClaudeRadar(), refreshClaudeActivity());
  }
  return Promise.all(jobs);
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'light';
  await session.defaultSession.setProxy({ mode: 'system' });
  await loadSettings();
  applyAppearance();
  await loadAlertState();
  await loadUsageHistory();
  await refreshModelCatalog();
  await loadRadarCache();
  if (!state.radar.data) state.radar.data = normalizeRadar(null);
  modelCatalogTimer = setInterval(refreshModelCatalog, MODEL_CATALOG_REFRESH_MS);
  modelCatalogTimer.unref?.();
  applyPanelHotkey();
  if (process.env.CMM_DEBUG_STATE_PATH) {
    setInterval(() => {
      fs.writeFile(process.env.CMM_DEBUG_STATE_PATH, JSON.stringify(state, null, 2)).catch(() => {});
    }, 2000);
  }
  app.dock?.hide();
  createTray();
  // 提前完成 Chromium、页面和首帧数据的冷启动，第一次点击只负责显示窗口。
  createPanel();
  await syncMobileServer();
  if (settings.cloudSyncEnabled) queueCloudSyncPush(0);
  cloudSyncRetryTimer = setInterval(() => {
    if (settings.cloudSyncEnabled && cloudSyncRuntime.status !== 'syncing') queueCloudSyncPush(0);
  }, CLOUD_SYNC_RETRY_MS);
  cloudSyncRetryTimer.unref?.();
  queueTouchBarStateWrite();
  setTimeout(() => {
    queueTouchBarStateWrite();
    ensureTouchBarHelper();
  }, 1200);
  refreshAll().catch(() => {});
  // 本机 Claude 记录约 134MB，冷扫要接近 1 秒。不预热的话这一秒会砸在
  // 第一次 GPT→Claude 切换的动画上；启动后台先读进缓存，之后切换都是增量。
  setTimeout(() => {
    if (isProviderEnabled('claude', settings.providerSettings)) collectClaudeEntries().catch(() => {});
    collectCodexEntries().catch(() => {});
  }, TRANSCRIPT_PREWARM_DELAY_MS).unref?.();
  usageTimer = setInterval(refreshUsage, USAGE_REFRESH_MS);
  claudeUsageTimer = setInterval(() => {
    if (isProviderEnabled('claude', settings.providerSettings)) refreshClaudeUsage();
  }, CLAUDE_USAGE_REFRESH_MS);
  radarTimer = setInterval(() => {
    refreshRadar();
    if (isProviderEnabled('claude', settings.providerSettings)) refreshClaudeRadar();
  }, RADAR_REFRESH_MS);
  serviceStatusTimer = setInterval(() => {
    refreshServiceStatuses().catch(() => {});
  }, SERVICE_STATUS_REFRESH_MS);
  tokenActivityTimer = setInterval(() => {
    Promise.all(refreshActivities()).catch(() => {});
  }, TOKEN_ACTIVITY_REFRESH_MS);
  extraUsageTimer = setInterval(() => {
    refreshEnabledExtras().catch(() => {});
  }, EXTRA_USAGE_REFRESH_MS);
  powerMonitor.on('resume', () => scheduleWakeRefresh('resume'));
  powerMonitor.on('unlock-screen', () => scheduleWakeRefresh('unlock'));
});

app.on('before-quit', () => {
  if (modelCatalogTimer) clearInterval(modelCatalogTimer);
  if (sendStateTimer) clearTimeout(sendStateTimer);
  sendStateTimer = null;
  clearPanelHeightShrinkTimer();
  stopPanelBoundsAnimation();
  if (usageTimer) clearInterval(usageTimer);
  if (claudeUsageTimer) clearInterval(claudeUsageTimer);
  if (claudeReconnectTimer) clearInterval(claudeReconnectTimer);
  if (radarTimer) clearInterval(radarTimer);
  if (serviceStatusTimer) clearInterval(serviceStatusTimer);
  if (tokenActivityTimer) clearInterval(tokenActivityTimer);
  if (extraUsageTimer) clearInterval(extraUsageTimer);
  if (wakeRefreshTimer) clearTimeout(wakeRefreshTimer);
  if (wakeRetryTimer) clearTimeout(wakeRetryTimer);
  if (resetRefreshTimer) clearTimeout(resetRefreshTimer);
  if (cloudSyncPushTimer) clearTimeout(cloudSyncPushTimer);
  if (cloudSyncRetryTimer) clearInterval(cloudSyncRetryTimer);
  stopPanelFollowMonitor();
  stopPanelAnimation();
  clearPanelBlurTimer();
  if (touchBarStateTimer) clearTimeout(touchBarStateTimer);
  if (alertStateSaveTimer) {
    clearTimeout(alertStateSaveTimer);
    alertStateSaveTimer = null;
    try {
      require('fs').writeFileSync(ALERT_STATE_PATH, JSON.stringify(alertState), 'utf8');
    } catch {
      // 退出时保存失败可以接受。
    }
  }
  if (usageHistorySaveTimer) {
    clearTimeout(usageHistorySaveTimer);
    usageHistorySaveTimer = null;
    try {
      require('fs').writeFileSync(USAGE_HISTORY_PATH, JSON.stringify(usageHistory), 'utf8');
    } catch {
      // 退出时保存失败可以接受，下次会重新采样。
    }
  }
  globalShortcut.unregisterAll();
  stopTouchBarHelper();
  if (mobileServer) mobileServer.stop().catch(() => {});
});

app.on('window-all-closed', () => {});

ipcMain.handle('state:get', () => state);
ipcMain.on('panel:renderer-ready', (event, height) => {
  if (!panel || panel.isDestroyed() || event.sender !== panel.webContents) return;
  const measured = Math.round(Number(height));
  if (Number.isFinite(measured) && measured > 0) {
    clearPanelHeightShrinkTimer();
    panelContentHeight = clamp(measured, PANEL_CONTENT_MIN_HEIGHT, PANEL_CONTENT_MAX_HEIGHT);
  }
  panelRendererReady = true;
  if (pendingPanelShow) showPanelAnimated();
});
ipcMain.on('panel:content-height', (event, height) => {
  if (!panel || panel.isDestroyed() || event.sender !== panel.webContents) return;
  const next = Math.round(Number(height));
  if (!Number.isFinite(next) || next <= 0) return;
  if (Math.abs(next - panelContentHeight) <= PANEL_HEIGHT_EPSILON) return;
  clearPanelHeightShrinkTimer();
  if (next > panelContentHeight) {
    panelContentHeight = next;
    applyPanelContentHeight();
    return;
  }
  panelHeightShrinkTimer = setTimeout(() => {
    panelHeightShrinkTimer = null;
    panelContentHeight = next;
    applyPanelContentHeight();
  }, PANEL_HEIGHT_SHRINK_DELAY_MS);
  panelHeightShrinkTimer.unref?.();
});
ipcMain.handle('state:refresh', async () => {
  if (state.provider === 'claude') invalidateClaudeEntrySnapshot();
  else if (state.provider === 'codex') invalidateCodexEntrySnapshot();
  await refreshModelCatalog();
  await refreshProvider(state.provider);
  return state;
});
ipcMain.handle('claude:reconnect', async () => {
  try {
    return await startClaudeReconnect();
  } catch (error) {
    return { ok: false, command: CLAUDE_LOGIN_COMMAND, error: error?.message || String(error) };
  }
});
ipcMain.handle('provider:set', (_event, provider) => selectProvider(provider, { source: 'manual' }));
ipcMain.handle('settings:get', () => getSettingsSnapshot());
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('settings:update', (_event, nextSettings) => saveSettings(nextSettings));
ipcMain.handle('alerts:test-webhook', async (_event, url) => {
  try {
    return await testWebhook(url);
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});
ipcMain.handle('mobile:open', () => {
  const url = getPreferredMobileAccessUrl();
  if (url) shell.openExternal(url);
  return Boolean(url);
});
ipcMain.handle('mobile:copy-link', () => {
  const url = getPreferredMobileAccessUrl();
  if (url) clipboard.writeText(url);
  return Boolean(url);
});
ipcMain.handle('mobile:rotate-token', async () => {
  await saveSettings({ mobileAccessToken: createAccessToken() });
  return getSettingsSnapshot();
});
ipcMain.handle('mobile:get-qr', () => createMobileQrDataUrl());
ipcMain.handle('mobile:tailscale-status', async () => {
  await refreshTailscaleRuntime();
  sendSettings();
  return getSettingsSnapshot();
});
ipcMain.handle('mobile:tailscale-configure', () => configureTailscaleServe());
ipcMain.handle('mobile:tailscale-install', () => shell.openExternal(TAILSCALE_DOWNLOAD_URL));
ipcMain.handle('cloud-sync:configure', (_event, options) => configureCloudSync(options));
ipcMain.handle('cloud-sync:push', async () => {
  await uploadCloudSyncSnapshot({ force: true });
  return getSettingsSnapshot();
});
ipcMain.handle('cloud-sync:get-qr', () => createCloudSyncQrDataUrl());
ipcMain.handle('cloud-sync:copy-link', async () => {
  const info = await getCloudSyncPairingInfo();
  if (info?.pairingUrl) clipboard.writeText(info.pairingUrl);
  return Boolean(info?.pairingUrl);
});
ipcMain.handle('cloud-sync:copy-recovery', async () => {
  const info = await getCloudSyncPairingInfo();
  if (info?.recoveryCode) clipboard.writeText(info.recoveryCode);
  return Boolean(info?.recoveryCode);
});
ipcMain.handle('cloud-sync:open', async () => {
  const info = await getCloudSyncPairingInfo();
  if (info?.pairingUrl) shell.openExternal(info.pairingUrl);
  return Boolean(info?.pairingUrl);
});
ipcMain.handle('cloud-sync:reset', () => resetCloudSyncPairing());
ipcMain.handle('app:open-radar', () => shell.openExternal(state.provider === 'claude' ? CLAUDE_RADAR_HOME : RADAR_HOME));
ipcMain.handle('app:show-in-folder', () => shell.showItemInFolder(app.getPath('exe')));
ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('external:open', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});
