const { app, BrowserWindow, Tray, ipcMain, nativeImage, screen, shell, globalShortcut, Notification, clipboard } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const qrcode = require('qrcode-generator');
const i18n = require('./i18n');
const { parseCodexRolloutLines } = require('./codex-token-activity');
const { parseClaudeTranscriptLines } = require('./claude-token-activity');
const { buildActivityWindows } = require('./activity-windows');
const { ForegroundProviderTracker } = require('./foreground-provider');
const { readTranscriptFile } = require('./transcript-reader');
const {
  createAccessToken,
  createMobilePayload,
  createMobileServer,
  findPreferredLanAddress
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
const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const CLAUDE_OAUTH_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
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
const USAGE_HISTORY_RETENTION_MS = 7 * 24 * 3600_000;
const USAGE_HISTORY_VIEW_MS = 24 * 3600_000;
const USAGE_HISTORY_VIEW_POINTS = 200;
const PANEL_HOTKEY = 'Alt+Command+U';
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

const USAGE_REFRESH_MS = 120_000;
const CLAUDE_USAGE_REFRESH_MS = 5 * 60_000;
const EXTRA_USAGE_REFRESH_MS = 5 * 60_000;
const RADAR_REFRESH_MS = 15 * 60_000;
const TOKEN_ACTIVITY_REFRESH_MS = 5 * 60_000;
const PANEL_FOLLOW_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;
const PANEL_WIDTH = 406;
// 面板高度跟随当前页内容，渲染层量好后通过 panel:content-height 报上来；
// 这两个常量只是首帧的起点和上下限（额外平台只有两张额度卡，用量页会很短）。
const PANEL_HEIGHT = 640;
const PANEL_CONTENT_MIN_HEIGHT = 300;
const PANEL_CONTENT_MAX_HEIGHT = 780;
// 切换平台时内容高度会短暂抖动（刷新态和稳定态差十几像素）。变高立刻生效免得内容被裁，
// 变矮则要先稳住一段时间再收，避免一次切换里连着两次 setBounds 压在动画上造成卡顿。
const PANEL_HEIGHT_EPSILON = 6;
const PANEL_HEIGHT_SHRINK_DELAY_MS = 420;
const SEND_STATE_COALESCE_MS = 24;
const TRANSCRIPT_PREWARM_DELAY_MS = 5_000;
const PANEL_MIN_WIDTH = 330;
const PANEL_MIN_HEIGHT = 260;
const PANEL_VISIBLE_INSET = 6;
const PANEL_CLOSE_MS = 230;
const POINTER_OPEN_GRACE_MS = 180;
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
  usageHistory: { codex: [], claude: [] },
  usage: idleSlice(),
  radar: idleSlice(),
  tokenActivity: idleSlice(),
  claudeUsage: idleSlice(),
  claudeRadar: idleSlice(),
  claudeActivity: idleSlice(),
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
  hotkeyEnabled: true,
  mobileEnabled: false,
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
  if (panel.isVisible()) {
    panel.moveTop();
  } else {
    showPanelAnimated();
  }
});

let tray = null;
let panel = null;
let settingsWindow = null;
let settings = { ...defaultSettings };
let usageTimer = null;
let claudeUsageTimer = null;
let radarTimer = null;
let tokenActivityTimer = null;
let extraUsageTimer = null;
let panelFollowTimer = null;
let lastTrayActivationAt = 0;
let panelShownAt = 0;
let cursorOutsideSince = 0;
let panelAnimationTimer = null;
let panelBlurTimer = null;
let panelOpenedFromTopEdge = false;
let panelRendererReady = false;
let pendingPanelShow = false;
let panelContentHeight = 0;
let panelHeightShrinkTimer = null;
let sendStateTimer = null;
let touchBarHelper = null;
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
const refreshJobs = new Map();

function runRefreshOnce(key, task) {
  if (refreshJobs.has(key)) return refreshJobs.get(key);
  const job = Promise.resolve()
    .then(task)
    .finally(() => refreshJobs.delete(key));
  refreshJobs.set(key, job);
  return job;
}

function refreshStateSlice(jobKey, stateKey, loadData, { formatError, onSettled } = {}) {
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
        fetchedAt: Date.now()
      };
    } catch (error) {
      state[stateKey] = {
        ...state[stateKey],
        status: 'error',
        error: formatError ? formatError(error) : error.message
      };
    }

    onSettled?.();
    sendState();
    return state[stateKey];
  });
}

function createTray() {
  tray = new Tray(createTransparentTrayImage());
  tray.setTitle('GPT 5h：--  周：--');
  tray.setToolTip('Codex Menu Meter');
  tray.setIgnoreDoubleClickEvents(true);
  tray.on('mouse-down', handleTrayActivation);
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
    hasShadow: false,
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
    panel = null;
    panelRendererReady = false;
    pendingPanelShow = false;
  });
}

function preparePanelForFullScreen() {
  if (!panel || panel.isDestroyed()) return;
  panel.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  });
  // 'screen-saver' 层级和真正的锁屏界面同层，macOS 会因此认为“有东西要一直显示在
  // 屏幕保护程序之上”，从而抑制自动息屏/自动锁屏——即使这个面板窗口当时是隐藏的，
  // 这个层级设置也长期附着在窗口对象上（面板只在首次打开时创建一次，之后仅隐藏/显示）。
  // 'pop-up-menu' 仍然足够盖住全屏应用，但不在系统保留给屏幕保护程序的那个特殊层级上。
  panel.setAlwaysOnTop(true, 'pop-up-menu', 1);
}

function handleTrayActivation(event) {
  if (event?.button === 2 || event?.button === 'right') return;
  const now = Date.now();
  if (now - lastTrayActivationAt < 280) return;
  lastTrayActivationAt = now;
  togglePanel();
}

function togglePanel() {
  if (!panel) createPanel();
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

function showPanelAnimated() {
  if (!panel) return;
  if (!panelRendererReady) {
    pendingPanelShow = true;
    return;
  }
  pendingPanelShow = false;
  clearPanelBlurTimer();
  const targetBounds = positionPanel();
  if (!targetBounds) return;
  stopPanelAnimation();
  preparePanelForFullScreen();
  panel.setOpacity(0);
  panel.setBounds(targetBounds);
  panelShownAt = Date.now();
  cursorOutsideSince = 0;
  panelOpenedFromTopEdge = isCursorInTopMenuArea();
  panel.show();
  panel.focus();
  panel.webContents.send('panel:motion', 'opening');
  startPanelFollowMonitor();
  panel.moveTop();
  // 全屏空间下 show 后窗口层级偶尔晚一拍生效，保留一次轻量兜底即可。
  setTimeout(() => {
    if (!panel || panel.isDestroyed() || !panel.isVisible()) return;
    preparePanelForFullScreen();
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
  if (!panel || !panel.isVisible()) return;
  clearPanelBlurTimer();
  panelOpenedFromTopEdge = false;
  panel.webContents.send('panel:motion', 'closing');
  stopPanelFollowMonitor();
  stopPanelAnimation();
  panel.setOpacity(1);
  panelAnimationTimer = setTimeout(() => {
    panelAnimationTimer = null;
    if (!panel || panel.isDestroyed()) return;
    panel.hide();
    panel.setOpacity(1);
  }, PANEL_CLOSE_MS);
}

function stopPanelAnimation() {
  if (!panelAnimationTimer) return;
  clearTimeout(panelAnimationTimer);
  panelAnimationTimer = null;
}

function handlePanelBlur() {
  clearPanelBlurTimer();
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

function applyPanelContentHeight() {
  if (!panel || panel.isDestroyed() || !panel.isVisible()) return;
  const bounds = positionPanel();
  if (!bounds) return;
  const current = panel.getBounds();
  if (bounds.height === current.height && bounds.x === current.x && bounds.y === current.y) return;
  panel.setBounds(bounds);
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
    backgroundColor: '#0b1116',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true
    }
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
  } catch {
    settings = normalizeSettings(defaultSettings);
  }
  syncStateWithSettings();
}

async function saveSettings(nextSettings) {
  const previous = settings;
  settings = normalizeSettings({ ...settings, ...nextSettings });
  syncStateWithSettings();
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  if (previous.openAtLogin !== settings.openAtLogin) applySystemSettings();
  if (previous.hotkeyEnabled !== settings.hotkeyEnabled) applyPanelHotkey();
  if (previous.mobileEnabled !== settings.mobileEnabled) await syncMobileServer();
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
    hotkeyEnabled: value?.hotkeyEnabled === undefined
      ? defaultSettings.hotkeyEnabled
      : Boolean(value.hotkeyEnabled),
    mobileEnabled: value?.mobileEnabled === undefined
      ? defaultSettings.mobileEnabled
      : Boolean(value.mobileEnabled),
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
  const remoteAccessUrl = mobileRuntime.remoteBaseUrl
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
  const address = findPreferredLanAddress(os.networkInterfaces());
  return address ? `http://${address}:${mobileRuntime.port}` : null;
}

function getPreferredMobileAccessUrl() {
  const remoteUrl = mobileRuntime.remoteBaseUrl
    ? createMobileAccessUrl(mobileRuntime.remoteBaseUrl)
    : null;
  const lanBaseUrl = getMobileLanBaseUrl();
  const lanUrl = lanBaseUrl ? createMobileAccessUrl(lanBaseUrl) : null;
  return remoteUrl || lanUrl || createMobileAccessUrl(mobileRuntime.localBaseUrl);
}

async function syncMobileServer() {
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
      host: MOBILE_HOST,
      port: MOBILE_PORT
    });
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
    return await fetch(url, { ...options, signal: controller.signal });
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
    cloudSyncPushPending = true;
    return cloudSyncInFlight;
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
      const payload = createMobilePayload(state);
      payload.sync = {
        source: 'mac',
        generatedAt: Date.now()
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
  await deleteCloudSnapshot(previousCredentials, settings.cloudSyncServerUrl);
  await deleteCloudSyncSecret(settings.cloudSyncAccountId);
  const credentials = await createAndStoreCloudSyncCredentials();
  await saveSettings({ cloudSyncAccountId: credentials.accountId });
  await uploadCloudSyncSnapshot({ force: true });
  return getSettingsSnapshot();
}

async function getCodexAccessToken() {
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
  return token;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CodexMenuMeter/0.1',
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.url = url;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function requestErrorMessage(error, provider) {
  if (error?.status === 401) return tr('errExpired', { provider });
  if (error?.name === 'AbortError') return tr('errTimeout', { provider });
  if (error?.status) return tr('errHttp', { status: error.status });
  return error?.message || tr('errFetch', { provider });
}

function refreshUsage() {
  return refreshStateSlice('codex-usage', 'usage', async () => {
    const token = await getCodexAccessToken();
    const [usage, resetCredits] = await Promise.all([
      fetchJson(CODEX_USAGE_URL, { headers: { Authorization: `Bearer ${token}` } }),
      fetchJson(RESET_CREDITS_URL, { headers: { Authorization: `Bearer ${token}` } })
        .catch((error) => ({ error: requestErrorMessage(error, 'Codex') }))
    ]);
    return normalizeUsage(usage, resetCredits);
  }, {
    formatError: (error) => requestErrorMessage(error, 'Codex'),
    onSettled: () => {
      syncActivityWindows('codex');
      updateTrayTitle();
      recordUsageSample('codex');
    }
  });
}

function normalizeUsage(raw, resetCredits) {
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

function refreshRadar() {
  return refreshStateSlice('codex-radar', 'radar', async () => {
    const radar = await fetchJson(RADAR_URL, { headers: { Referer: RADAR_HOME } });
    return normalizeRadar(radar);
  });
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
    appendIqItem(items, seenModels, null, modelIq.latest);
  }

  Object.values(comparisons).forEach((value) => {
    if (value?.latest) appendIqItem(items, seenModels, value.label, value.latest);
  });

  return {
    monitoredAt: raw?.monitored_at || null,
    modelIq: {
      latestDate: modelIq.latest?.date || null,
      updatedAt: modelIq.latest?.updated_at || modelIq.updated_at || null,
      items
    },
    quotaRadar: {
      updatedAt: modelIq.quota_radar?.updated_at || null,
      rows: Array.isArray(modelIq.quota_radar?.rows) ? modelIq.quota_radar.rows : []
    },
    sourceUrl: raw?.links?.html || RADAR_HOME
  };
}

function appendIqItem(items, seenModels, label, latest) {
  const identity = normalizeIqIdentity(label, latest);
  const identityKey = `${identity.modelLabel.toLowerCase()}|${identity.reasoningEffort.toLowerCase()}`;
  if (seenModels.has(identityKey)) return;
  seenModels.add(identityKey);
  items.push({
    label: identity.label,
    modelLabel: identity.modelLabel,
    reasoningEffort: identity.reasoningEffort,
    score: latest.score,
    status: latest.status,
    passed: latest.passed,
    tasks: latest.tasks,
    costUsd: latest.cost_usd,
    wallTimeHuman: latest.wall_time_human
  });
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

async function getClaudeCredentials({ force = false, excludeSource = null, excludeAccessToken = null } = {}) {
  if (!force && claudeCredentialCache && (!claudeCredentialCache.expiresAt || claudeCredentialCache.expiresAt - Date.now() > 60_000)) {
    return claudeCredentialCache;
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
      if (!credentials.refreshToken) continue;
      credentials = await refreshClaudeCredentials(credentials).catch(() => null);
      if (!credentials) continue;
    }

    claudeCredentialCache = credentials;
    return credentials;
  }

  return null;
}

async function refreshClaudeCredentials(credentials) {
  if (!credentials?.refreshToken) return null;
  const refreshed = await refreshClaudeOAuth(credentials.refreshToken);
  const raw = { ...(credentials.raw || {}), ...refreshed };
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
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token || refreshToken,
    expiresAt: Date.now() + (Number(raw.expires_in) || 3600) * 1000
  };
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
    }
  });
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
    officialError = claudeError('claude-no-creds');
  }

  throw officialError || claudeError('claude-unavailable');
}

async function fetchClaudeOfficialUsage(credentials) {
  const raw = await fetchJson(CLAUDE_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20'
    }
  });
  return normalizeClaudeOfficialUsage(raw, credentials);
}

function claudeUsageErrorMessage(error) {
  if (error?.status === 429) return tr('errClaude429');
  if (error?.name === 'AbortError') return tr('errClaudeTimeout');
  if (Number(error?.status) >= 500) return tr('errClaude5xx');
  if (error?.code === 'claude-no-creds') return tr('errClaudeNoCli');
  if (error?.code === 'claude-bad-data') return tr('errClaudeBadData');
  if (error?.code === 'claude-unavailable') return tr('errClaudeUnavailable');
  return requestErrorMessage(error, 'Claude');
}

function normalizeClaudeOfficialUsage(raw, credentials) {
  const primary = normalizeClaudeWindow(raw?.five_hour);
  const secondary = normalizeClaudeWindow(raw?.seven_day);
  if (!primary && !secondary) return null;

  const extraWindows = [];
  for (const [key, value] of Object.entries(raw || {})) {
    if (key === 'five_hour' || key === 'seven_day' || !key.startsWith('seven_day_')) continue;
    if (!value || typeof value !== 'object' || value.utilization === undefined) continue;
    const name = key
      .slice('seven_day_'.length)
      .split('_')
      .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ''))
      .join(' ');
    const window = normalizeClaudeWindow(value);
    if (window) extraWindows.push({ ...window, name });
  }

  return {
    planType: credentials?.subscriptionType || null,
    primaryWindow: primary,
    secondaryWindow: secondary,
    extraWindows,
    limitReached: [primary, secondary, ...extraWindows].some((item) => item && item.usedPercent >= 100)
  };
}

function normalizeClaudeWindow(windowValue) {
  if (!windowValue) return null;
  const usedPercent = clamp(Math.round(Number(windowValue.utilization ?? 0)), 0, 100);
  const resetAt = parseClaudeTimestamp(windowValue.resets_at);
  return {
    usedPercent,
    remainingPercent: clamp(100 - usedPercent, 0, 100),
    resetAt,
    inactive: !resetAt && usedPercent === 0
  };
}

function parseClaudeTimestamp(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
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
  for (const entry of entries) {
    if (entry.ts < cutoffTs) continue;
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
        sessions: new Set(),
        models: new Map()
      };
      dayMap.set(day, bucket);
    }
    bucket.weighted += entry.weighted;
    bucket.tokens += entry.tokens;
    bucket.ioTokens += entry.ioTokens;
    bucket.inputTokens += Number(entry.inputTokens) || 0;
    bucket.cachedInputTokens += Number(entry.cachedInputTokens) || 0;
    if (entry.sessionId) bucket.sessions.add(entry.sessionId);
    if (entry.model) {
      const model = bucket.models.get(entry.model) || { weighted: 0, tokens: 0 };
      model.weighted += entry.weighted;
      model.tokens += entry.tokens;
      bucket.models.set(entry.model, model);
    }
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
      costUsd: bucketCostUsd(bucket, source),
      threads: bucket.sessions.size,
      models: [...bucket.models.entries()]
        .sort((a, b) => b[1].weighted - a[1].weighted)
        .map(([model, totals]) => ({ model, value: totals.tokens }))
    }));

  return {
    source,
    units: 'tokens',
    windowDays: ACTIVITY_WINDOW_DAYS,
    windows: buildActivityWindows(entries, usage),
    days
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

// 加权值以"输入 token 等价量"计，乘以该模型每百万输入 token 的牌价即得美元成本。
const MODEL_INPUT_PRICES_USD_PER_MTOK = [
  [/^claude-(fable|mythos)-5/i, 10],
  [/^claude-opus/i, 5],
  [/^claude-sonnet/i, 3],
  [/^claude-haiku/i, 1],
  [/^gpt-5\.6-sol/i, 5],
  [/^gpt-5\.6-terra/i, 2.5],
  [/^gpt-5\.6-luna/i, 1],
  [/^gpt-5\.5/i, 5],
  [/^gpt-5\.4-mini/i, 0.25],
  [/^gpt-5\.4/i, 1.25],
  [/^gpt-/i, 2.5],
  [/^claude-/i, 5]
];

function modelInputPriceUsd(model, source) {
  const name = String(model || '');
  for (const [pattern, price] of MODEL_INPUT_PRICES_USD_PER_MTOK) {
    if (pattern.test(name)) return price;
  }
  return source === 'codex_local' ? 2.5 : 5;
}

function bucketCostUsd(bucket, source) {
  let cost = 0;
  let attributed = 0;
  for (const [model, totals] of bucket.models.entries()) {
    cost += (totals.weighted / 1e6) * modelInputPriceUsd(model, source);
    attributed += totals.weighted;
  }
  const residual = bucket.weighted - attributed;
  if (residual > 0) cost += (residual / 1e6) * modelInputPriceUsd(null, source);
  return Math.round(cost * 100) / 100;
}

function formatLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function refreshClaudeRadar() {
  return refreshStateSlice('claude-radar', 'claudeRadar', async () => {
    const raw = await fetchJson(CLAUDE_RADAR_URL, { headers: { Referer: CLAUDE_RADAR_HOME } });
    return normalizeClaudeRadar(raw);
  });
}

function normalizeClaudeRadar(raw) {
  const models = Array.isArray(raw?.iq?.models) ? raw.iq.models : [];
  const items = sortClaudeIqItems(models
    .map((model) => normalizeClaudeIqItem(model))
    .filter(Boolean));
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

const usageHistory = { codex: [], claude: [] };
let usageHistorySaveTimer = null;
const alertState = {
  codex: { five: { lastThreshold: null, nearCap: false }, week: { lastThreshold: null, nearCap: false } },
  claude: { five: { lastThreshold: null, nearCap: false }, week: { lastThreshold: null, nearCap: false } }
};

async function loadUsageHistory() {
  try {
    const raw = JSON.parse(await fs.readFile(USAGE_HISTORY_PATH, 'utf8'));
    const cutoff = Date.now() - USAGE_HISTORY_RETENTION_MS;
    for (const provider of ['codex', 'claude']) {
      if (Array.isArray(raw?.[provider])) {
        usageHistory[provider] = raw[provider].filter((s) => Number(s?.t) > cutoff);
      }
      refreshUsageHistoryView(provider);
    }
  } catch {
    // 首次运行没有历史文件，正常。
  }
}

function queueUsageHistorySave() {
  if (usageHistorySaveTimer) return;
  usageHistorySaveTimer = setTimeout(() => {
    usageHistorySaveTimer = null;
    fs.writeFile(USAGE_HISTORY_PATH, JSON.stringify(usageHistory), 'utf8').catch(() => {});
  }, 30_000);
}

function recordUsageSample(provider) {
  const slice = provider === 'claude' ? state.claudeUsage : state.usage;
  if (slice.status !== 'ok' || !slice.data) return;
  const usage = slice.data;
  const sample = {
    t: Date.now(),
    five: Number.isFinite(usage.primaryWindow?.usedPercent) ? usage.primaryWindow.usedPercent : null,
    week: Number.isFinite(usage.secondaryWindow?.usedPercent) ? usage.secondaryWindow.usedPercent : null,
    fiveReset: usage.primaryWindow?.resetAt || null,
    weekReset: usage.secondaryWindow?.resetAt || null
  };
  const list = usageHistory[provider];
  const previous = list[list.length - 1] || null;
  list.push(sample);
  const cutoff = Date.now() - USAGE_HISTORY_RETENTION_MS;
  while (list.length && list[0].t < cutoff) list.shift();
  refreshUsageHistoryView(provider);
  checkUsageAlerts(provider, sample, previous);
  queueUsageHistorySave();
}

function refreshUsageHistoryView(provider) {
  const cutoff = Date.now() - USAGE_HISTORY_VIEW_MS;
  const recent = usageHistory[provider].filter((s) => s.t >= cutoff);
  // IPC 只发近 24 小时并抽稀到 ≤200 个点，别把整份历史塞给渲染层。
  const step = Math.max(1, Math.ceil(recent.length / USAGE_HISTORY_VIEW_POINTS));
  const view = recent.filter((_, index) => index % step === 0 || index === recent.length - 1);
  state.usageHistory[provider] = view.map((s) => ({ t: s.t, five: s.five, week: s.week }));
}

function checkUsageAlerts(provider, sample, previous) {
  if (!settings.notificationsEnabled || !Notification.isSupported()) return;
  const name = provider === 'claude' ? 'Claude' : 'GPT';
  checkWindowAlert(provider, name, 'five', tr('windowName5h'), sample.five, previous?.five);
  checkWindowAlert(provider, name, 'week', tr('windowNameWeek'), sample.week, previous?.week);
}

function checkWindowAlert(provider, name, windowKey, windowLabel, used, previousUsed) {
  if (!Number.isFinite(used)) return;
  const tracker = alertState[provider][windowKey];

  // 用量大幅回落 → 窗口已重置。
  if (Number.isFinite(previousUsed) && previousUsed - used >= 30) {
    if (tracker.nearCap) {
      notify(tr('notifyResetTitle', { name }), tr('notifyResetBody', { name, window: windowLabel }));
    }
    tracker.lastThreshold = null;
    tracker.nearCap = false;
  }

  if (used >= 85) tracker.nearCap = true;

  const remaining = 100 - used;
  const threshold = remaining <= 5 ? 5 : remaining <= 20 ? 20 : null;
  if (threshold && tracker.lastThreshold !== threshold && (tracker.lastThreshold === null || threshold < tracker.lastThreshold)) {
    tracker.lastThreshold = threshold;
    notify(
      tr('notifyLowTitle', { name, window: windowLabel }),
      tr('notifyLowBody', { name, window: windowLabel, remaining })
    );
  }
  if (!threshold && tracker.lastThreshold !== null && remaining > 25) {
    tracker.lastThreshold = null;
  }
}

function notify(title, body) {
  try {
    new Notification({ title, body, silent: false }).show();
  } catch {
    // 通知失败不影响主流程。
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
    onSettled: updateTrayTitle
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
    stdio: ['ignore', 'pipe', 'ignore'],
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

function handleTouchBarHelperOutput(chunk) {
  touchBarHelperOutput += String(chunk || '');
  const lines = touchBarHelperOutput.split('\n');
  touchBarHelperOutput = lines.pop() || '';
  for (const line of lines) {
    const message = line.trim();
    if (message === 'pointer-down') handleGlobalPointerDown();
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
  hidePanelAnimated();
}

function stopTouchBarHelper() {
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
  return {
    label,
    usage: {
      five: usage?.fiveHourUnlimited
        ? { label: '5h', remainingPercent: null, resetAt: null, unlimited: true }
        : touchBarQuota('5h', usage?.primaryWindow),
      week: touchBarQuota('7d', usage?.secondaryWindow)
    },
    iq: iqItems.slice(0, 6).map((item) => ({
      label: item.label,
      compactLabel: compactTouchLabel(item.modelLabel || item.label, item.reasoningEffort, provider),
      score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
      status: item.status || 'unknown'
    }))
  };
}

function touchBarQuota(label, windowValue) {
  const remaining = Number(windowValue?.remainingPercent);
  return {
    label,
    remainingPercent: Number.isFinite(remaining) ? clamp(Math.round(remaining), 0, 100) : null,
    resetAt: Number.isFinite(Number(windowValue?.resetAt)) ? Number(windowValue.resetAt) : null
  };
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
  const known = { ultra: 'U', xhigh: 'XH', high: 'H', medium: 'M', low: 'L', minimal: 'MIN' };
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
  const jobs = [refreshUsage(), refreshRadar(), refreshEnabledExtras()];
  if (isProviderEnabled('claude', settings.providerSettings)) {
    jobs.push(refreshClaudeUsage(), refreshClaudeRadar());
  }
  jobs.push(...refreshActivities());
  return Promise.all(jobs);
}

function refreshAllForRemote() {
  const jobs = [
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
  await loadSettings();
  await loadUsageHistory();
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
  tokenActivityTimer = setInterval(() => {
    Promise.all(refreshActivities()).catch(() => {});
  }, TOKEN_ACTIVITY_REFRESH_MS);
  extraUsageTimer = setInterval(() => {
    refreshEnabledExtras().catch(() => {});
  }, EXTRA_USAGE_REFRESH_MS);
});

app.on('before-quit', () => {
  if (sendStateTimer) clearTimeout(sendStateTimer);
  sendStateTimer = null;
  clearPanelHeightShrinkTimer();
  if (usageTimer) clearInterval(usageTimer);
  if (claudeUsageTimer) clearInterval(claudeUsageTimer);
  if (radarTimer) clearInterval(radarTimer);
  if (tokenActivityTimer) clearInterval(tokenActivityTimer);
  if (extraUsageTimer) clearInterval(extraUsageTimer);
  if (cloudSyncPushTimer) clearTimeout(cloudSyncPushTimer);
  if (cloudSyncRetryTimer) clearInterval(cloudSyncRetryTimer);
  stopPanelFollowMonitor();
  stopPanelAnimation();
  clearPanelBlurTimer();
  if (touchBarStateTimer) clearTimeout(touchBarStateTimer);
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
ipcMain.on('panel:renderer-ready', (event) => {
  if (!panel || panel.isDestroyed() || event.sender !== panel.webContents) return;
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
  await refreshProvider(state.provider);
  return state;
});
ipcMain.handle('provider:set', (_event, provider) => selectProvider(provider, { source: 'manual' }));
ipcMain.handle('settings:get', () => getSettingsSnapshot());
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('settings:update', (_event, nextSettings) => saveSettings(nextSettings));
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
