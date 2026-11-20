const I18N = window.CMM_I18N;
const PROVIDERS = window.CMM_PROVIDERS;
const EXTRA_PROVIDER_IDS = PROVIDERS.USAGE_ONLY_PROVIDER_IDS;
const PROVIDER_LABELS = Object.fromEntries(PROVIDERS.PROVIDERS.map((provider) => [provider.id, provider.switchLabel]));
const EXTRA_PROVIDER_NAMES = Object.fromEntries(EXTRA_PROVIDER_IDS.map((id) => [id, PROVIDERS.PROVIDER_BY_ID[id].label]));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const MOTION_TIME_SCALE = 0.94;

const els = {
  panel: document.querySelector('.panel'),
  aurora: document.querySelector('.panel-aurora'),
  motionScan: document.getElementById('motionScan'),
  motionEdgeTop: document.getElementById('motionEdgeTop'),
  motionEdgeBottom: document.getElementById('motionEdgeBottom'),
  motionSparks: document.getElementById('motionSparks'),
  toolbar: document.querySelector('.toolbar'),
  radarPanel: document.getElementById('radarPanel'),
  refresh: document.getElementById('refresh'),
  statusLine: document.getElementById('statusLine'),
  providerSwitch: document.getElementById('providerSwitch'),
  tabUsageLabel: document.getElementById('tabUsageLabel'),
  tabRadarLabel: document.getElementById('tabRadarLabel'),
  usageTitle: document.getElementById('usageTitle'),
  tokenTitle: document.getElementById('tokenTitle'),
  trendTitle: document.getElementById('trendTitle'),
  trendLegend: document.getElementById('trendLegend'),
  usageTrend: document.getElementById('usageTrend'),
  iqTitle: document.getElementById('iqTitle'),
  quotaRadarTitle: document.getElementById('quotaRadarTitle'),
  resetTitle: document.getElementById('resetTitle'),
  radarSubtabs: [...document.querySelectorAll('.radar-subtab')],
  radarViews: [...document.querySelectorAll('.radar-view')],
  radarTabIntelligence: document.getElementById('radarTabIntelligence'),
  radarTabQuota: document.getElementById('radarTabQuota'),
  radarTabReset: document.getElementById('radarTabReset'),
  recommendedTitle: document.getElementById('recommendedTitle'),
  recommendedModel: document.getElementById('recommendedModel'),
  recommendedMeta: document.getElementById('recommendedMeta'),
  iqDegradeAlert: document.getElementById('iqDegradeAlert'),
  iqDegradeTitle: document.getElementById('iqDegradeTitle'),
  iqDegradeValue: document.getElementById('iqDegradeValue'),
  modelUsageTitle: document.getElementById('modelUsageTitle'),
  modelUsagePeriod: document.getElementById('modelUsagePeriod'),
  modelUsageSummary: document.getElementById('modelUsageSummary'),
  modelUsageRows: document.getElementById('modelUsageRows'),
  iqSortControls: document.getElementById('iqSortControls'),
  iqSortButtons: [...document.querySelectorAll('[data-iq-sort]')],
  expandModels: document.getElementById('expandModels'),
  quotaSource: document.getElementById('quotaSource'),
  usageUpdated: document.getElementById('usageUpdated'),
  meters: document.getElementById('meters'),
  tokenUpdated: document.getElementById('tokenUpdated'),
  tokenActivity: document.getElementById('tokenActivity'),
  tokenRange: document.getElementById('tokenRange'),
  iqDate: document.getElementById('iqDate'),
  iqGrid: document.getElementById('iqGrid'),
  modelCatalogNotice: document.getElementById('modelCatalogNotice'),
  radarDataNotice: document.getElementById('radarDataNotice'),
  radarBriefStatus: document.getElementById('radarBriefStatus'),
  modelCatalogNames: document.getElementById('modelCatalogNames'),
  latestModelsFilter: document.getElementById('latestModelsFilter'),
  quotaRows: document.getElementById('quotaRows'),
  resetCards: document.getElementById('resetCards'),
  openRadar: document.getElementById('openRadar'),
  chartTooltip: document.getElementById('chartTooltip'),
  tabs: [...document.querySelectorAll('.tab-button')],
  panels: [...document.querySelectorAll('.tab-panel')]
};

let currentState = null;
let lang = I18N.FALLBACK;
let activeTokenBar = null;
let activeTokenDay = null;
let scrollEdgeLock = null;
let providerSwitching = false;
const tabByProvider = {};
const radarViewByProvider = {};
const radarSortByProvider = {};
const radarExpandedByProvider = {};
const radarLatestByProvider = {};
const sectionSignatures = new Map();
const renderedMarkup = new WeakMap();
const disclosureState = new Map();

// 原位详情按平台保存，后台刷新不收起用户正在查看的内容。
function restoreDisclosures(root = document) {
  root.querySelectorAll('details[data-detail]').forEach((detail) => {
    detail.dataset.detailOwner = currentProviderKey();
    detail.open = disclosureState.get(`${detail.dataset.detailOwner}:${detail.dataset.detail}`) || false;
  });
}

document.addEventListener('toggle', (event) => {
  const detail = event.target;
  if (!detail.matches?.('details[data-detail]')) return;
  disclosureState.set(`${detail.dataset.detailOwner}:${detail.dataset.detail}`, detail.open);
  hideChartTooltip();
  queuePanelHeightReport({ hold: 120 });
}, true);

function detailMetric(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

// IPC 每次会带来新的对象；按可见区块的数据判断变化，保留未变化的 DOM 和悬停状态。
function renderSection(key, dependencies, renderContent) {
  const signature = JSON.stringify([currentProviderKey(), lang, ...dependencies]);
  if (sectionSignatures.get(key) === signature) return;
  renderContent();
  sectionSignatures.set(key, signature);
}

function updateHtml(element, markup) {
  if (!element || renderedMarkup.get(element) === markup) return false;
  element.innerHTML = markup;
  restoreDisclosures(element);
  renderedMarkup.set(element, markup);
  return true;
}

function T(key, params) {
  return I18N.t(lang, key, params);
}

// 主进程给「雷达数据源已下线」标的错误码：界面按中性提示处理，不当成读取失败。
const RADAR_PAUSED_CODE = 'radar-source-unavailable';

function currentProviderKey() {
  return currentState?.provider || els.panel.dataset.provider || 'codex';
}

els.tabs.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

els.radarSubtabs.forEach((button) => {
  button.addEventListener('click', () => setActiveRadarView(button.dataset.radarView));
});

els.iqSortButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const provider = currentProviderKey();
    const sort = button.dataset.iqSort || 'iq';
    radarSortByProvider[provider] = sort;
    if (currentState) renderIq(activeSlices(currentState).radar, provider);
    queuePanelHeightReport({ hold: 120 });
  });
});

els.expandModels?.addEventListener('click', () => {
  const provider = currentProviderKey();
  radarExpandedByProvider[provider] = !radarExpandedByProvider[provider];
  if (currentState) renderIq(activeSlices(currentState).radar, provider);
  queuePanelHeightReport({ hold: 120 });
});

els.providerSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('.provider-option');
  if (button && els.providerSwitch.contains(button)) {
    handleProviderClick(button.dataset.provider);
  }
});

els.latestModelsFilter.addEventListener('click', () => {
  const provider = currentProviderKey();
  radarLatestByProvider[provider] = !radarLatestByProvider[provider];
  radarExpandedByProvider[provider] = false;
  if (currentState) renderIq(activeSlices(currentState).radar, provider);
  queuePanelHeightReport({ hold: 120 });
});

async function handleProviderClick(provider) {
  if (providerSwitching || !provider) return;
  const current = currentState?.provider || els.panel.dataset.provider || 'codex';
  if (provider === current) return;
  providerSwitching = true;
  const setOptionsDisabled = (disabled) => {
    els.providerSwitch.querySelectorAll('.provider-option').forEach((option) => { option.disabled = disabled; });
  };
  setOptionsDisabled(true);
  syncProviderUi(provider);
  setActiveTab('usage', { provider, animate: false, renderContent: false });
  try {
    const state = await window.codexMeter.setProvider(provider);
    requestRender(state);
  } catch {
    if (currentState) {
      currentState = { ...currentState, provider: current };
      requestRender(currentState);
    }
  } finally {
    providerSwitching = false;
    setOptionsDisabled(false);
  }
}

let revealAnimations = [];

function revealActivePanel() {
  const activePanel = els.panels.find((panel) => panel.classList.contains('active'));
  if (!activePanel || reduceMotion.matches || document.hidden) return;
  revealAnimations.forEach((animation) => animation.cancel());
  const content = activePanel.id === 'radarPanel'
    ? activePanel.querySelector('.radar-view.active')
    : activePanel;
  revealAnimations = [animateOne(content, [
    { opacity: 0.6, transform: 'translate3d(0, 3px, 0)' },
    { opacity: 1, transform: 'translate3d(0, 0, 0)' }
  ], { duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })].filter(Boolean);
}

function providerList(state) {
  const enabled = Array.isArray(state?.enabledProviders) ? state.enabledProviders : ['codex'];
  const known = enabled.filter((id) => PROVIDERS.PROVIDER_BY_ID[id]);
  return known.includes('codex') ? known : ['codex', ...known];
}

function syncProviderUi(provider) {
  if (els.panel.dataset.provider !== provider) {
    els.panel.dataset.provider = provider;
  }
  const list = providerList(currentState);
  const listKey = list.join(',');
  if (els.providerSwitch.dataset.list !== listKey) {
    els.providerSwitch.dataset.list = listKey;
    els.providerSwitch.style.setProperty('--provider-count', list.length);
    els.providerSwitch.classList.toggle('many', list.length >= 4);
    els.providerSwitch.innerHTML = `
      <span class="provider-thumb" aria-hidden="true"></span>
      ${list.map((id) => `<button class="provider-option" type="button" data-provider="${id}" aria-pressed="false">${escapeHtml(PROVIDER_LABELS[id] || id)}</button>`).join('')}
    `;
  }
  els.providerSwitch.style.setProperty('--provider-index', Math.max(0, list.indexOf(provider)));
  els.providerSwitch.querySelectorAll('.provider-option').forEach((button) => {
    const active = button.dataset.provider === provider;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function activeSlices(state) {
  const provider = state.provider || 'codex';
  if (provider === 'claude') {
    return { usage: state.claudeUsage || {}, radar: state.claudeRadar || {}, activity: state.claudeActivity || {}, service: state.claudeStatus || {} };
  }
  if (EXTRA_PROVIDER_IDS.includes(provider)) {
    return { usage: state[`${provider}Usage`] || {}, radar: { status: 'idle' }, activity: { status: 'idle' }, service: { status: 'idle' } };
  }
  return { usage: state.usage, radar: state.radar, activity: state.tokenActivity, service: state.codexStatus || {} };
}

els.refresh.addEventListener('click', async () => {
  if (els.refresh.disabled) return;
  els.refresh.disabled = true;
  els.refresh.setAttribute('aria-busy', 'true');
  playRefreshEffect();
  els.refresh.classList.add('spinning');
  try {
    const state = await window.codexMeter.refresh();
    requestRender(state);
  } catch {
    // 主进程会推送各数据源的错误状态；失败时保留已显示的数据。
  } finally {
    els.refresh.classList.remove('spinning');
    els.refresh.disabled = false;
    els.refresh.removeAttribute('aria-busy');
  }
});

els.openRadar.addEventListener('click', () => {
  const provider = currentState?.provider || 'codex';
  // Claude 的重置时间来自官方用量接口，对应的「来源」是官方用量页，不是雷达站。
  if (provider === 'claude') {
    window.codexMeter.openExternal('https://claude.ai/settings/usage');
    return;
  }
  const url = (currentState ? activeSlices(currentState).radar?.data?.sourceUrl : null) || 'https://codexradar.com/';
  window.codexMeter.openExternal(url);
});

// 30 天热力图的格子和 7 天直方图的柱子都是「某一天」：悬停出提示、点击选中这一天。
const TOKEN_DAY_SELECTOR = '.token-heatmap-cell, .token-week-col';

els.tokenActivity.addEventListener('mouseover', (event) => {
  const cell = event.target.closest(TOKEN_DAY_SELECTOR);
  if (!cell || !els.tokenActivity.contains(cell)) return;
  activeTokenBar = cell;
  showChartTooltip(cell, event);
});

els.tokenActivity.addEventListener('mousemove', (event) => {
  if (!activeTokenBar) return;
  showChartTooltip(activeTokenBar, event);
});

els.tokenActivity.addEventListener('mouseout', (event) => {
  if (!activeTokenBar) return;
  const nextTarget = event.relatedTarget;
  if (nextTarget && activeTokenBar.contains(nextTarget)) return;
  const nextCell = nextTarget?.closest?.(TOKEN_DAY_SELECTOR);
  if (nextCell && els.tokenActivity.contains(nextCell)) {
    activeTokenBar = nextCell;
    showChartTooltip(nextCell, event);
    return;
  }
  activeTokenBar = null;
  hideChartTooltip();
});

els.tokenActivity.addEventListener('mouseleave', () => {
  activeTokenBar = null;
  hideChartTooltip();
});

els.meters.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action="claude-reconnect"]');
  if (action && els.meters.contains(action)) handleClaudeReconnect();
});

els.tokenActivity.addEventListener('click', (event) => {
  const cell = event.target.closest(TOKEN_DAY_SELECTOR);
  if (!cell || !els.tokenActivity.contains(cell)) return;
  selectTokenDay(cell);
});

els.tokenActivity.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const cell = event.target.closest(TOKEN_DAY_SELECTOR);
  if (!cell || !els.tokenActivity.contains(cell)) return;
  event.preventDefault();
  selectTokenDay(cell);
});

function selectTokenDay(cell) {
  if (!cell?.dataset.day) return;
  activeTokenDay = cell.dataset.day;
  activeTokenBar = null;
  hideChartTooltip();
  if (currentState) renderTokenActivity(activeSlices(currentState).activity);
  queuePanelHeightReport({ hold: 180 });
}

// Token 活动的时间范围：30 天热力图（默认），或 7 天按模型分色的直方图。记在本机，下次打开沿用。
const TOKEN_RANGE_STORAGE_KEY = 'cmm.tokenRange';
let tokenRange = readTokenRange();

function readTokenRange() {
  try {
    return window.localStorage.getItem(TOKEN_RANGE_STORAGE_KEY) === 'week' ? 'week' : 'month';
  } catch {
    return 'month';
  }
}

function setTokenRange(range) {
  const next = range === 'week' ? 'week' : 'month';
  if (next === tokenRange) return;
  tokenRange = next;
  try {
    window.localStorage.setItem(TOKEN_RANGE_STORAGE_KEY, next);
  } catch {
    // 存储不可用时只在本次打开期间生效。
  }
  activeTokenBar = null;
  hideChartTooltip();
  if (currentState) renderVisibleContent(currentState, 'usage');
  queuePanelHeightReport({ hold: 180 });
}

els.tokenRange?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-token-range]');
  if (!button || !els.tokenRange.contains(button)) return;
  event.preventDefault();
  setTokenRange(button.dataset.tokenRange);
});

function renderTokenRangeToggle() {
  if (!els.tokenRange) return;
  els.tokenRange.hidden = false;
  els.tokenRange.setAttribute('aria-label', T('tokenRangeAria'));
  const button = (key, label) => `<button type="button" class="trend-range-button${tokenRange === key ? ' active' : ''}" data-token-range="${key}" aria-pressed="${tokenRange === key}">${escapeHtml(label)}</button>`;
  updateHtml(els.tokenRange, `${button('week', T('tokenRangeWeek'))}${button('month', T('tokenRangeMonth'))}`);
}

els.panel.addEventListener('wheel', handlePanelWheel, { passive: true });

window.codexMeter.onState(requestRender);
window.codexMeter.onPanelMotion((motion) => {
  if (motion === 'opening') armStrayFocusGuard();
  animatePanelMotion(motion);
});
// 1.0.0 起面板用 showInactive() 弹出（别的应用全屏时才能排到最前），面板成为键盘窗口时 macOS 会按
// Tab 顺序把焦点放到第一个按钮 GPT 上，GPT 就一直带蓝色焦点框（用户 2026-11-17 截图问过）。
// 这一步和窗口 focus 事件谁先谁后不固定：面板页面正忙时，焦点会在 focus 事件之后才落到 GPT 上
// （实测在全屏应用上方打开时让页面忙 0.8 秒即可复现），只在 focus 事件里清焦点拦不住。所以分三层：
// 1. 焦点框只在用户真用键盘操作面板时显示：按键给 body 加 keyboard-focus（样式见 styles.css 末尾），
//    点鼠标或重新打开面板时去掉；
// 2. 窗口拿到焦点时清掉已有的焦点；
// 3. 打开后一秒内，不是按键带来的「键盘式」焦点也清掉，免得按空格误触 GPT。
const KEYBOARD_FOCUS_CLASS = 'keyboard-focus';
const STRAY_FOCUS_GUARD_MS = 1000;
const MODIFIER_KEYS = new Set(['Shift', 'Meta', 'Alt', 'Control', 'CapsLock', 'Fn']);
let strayFocusGuardUntil = 0;

function armStrayFocusGuard() {
  document.body.classList.remove(KEYBOARD_FOCUS_CLASS);
  strayFocusGuardUntil = performance.now() + STRAY_FOCUS_GUARD_MS;
}

document.addEventListener('keydown', (event) => {
  // 快捷键（含打开面板的 ⌥⌘U）和单按修饰键不算键盘导航。
  if (event.metaKey || event.ctrlKey || event.altKey || MODIFIER_KEYS.has(event.key)) return;
  strayFocusGuardUntil = 0;
  document.body.classList.add(KEYBOARD_FOCUS_CLASS);
}, true);
document.addEventListener('pointerdown', () => {
  document.body.classList.remove(KEYBOARD_FOCUS_CLASS);
}, true);
document.addEventListener('focusin', (event) => {
  if (document.body.classList.contains(KEYBOARD_FOCUS_CLASS)) return;
  if (performance.now() > strayFocusGuardUntil) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.matches(':focus-visible')) target.blur();
});
window.addEventListener('focus', () => {
  armStrayFocusGuard();
  const active = document.activeElement;
  if (active && active !== document.body && typeof active.blur === 'function') active.blur();
});
window.codexMeter.getState().then((state) => {
  requestRender(state);
});

// 相对时间（“X分钟后重置”等）需要周期重算，但面板藏在后台时白耗 CPU——只在可见时刷。
setInterval(() => {
  if (!document.hidden && currentState) requestRender(currentState);
}, 30_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentState) requestRender(currentState);
});

// ---- 面板高度跟随内容 ----
// 主进程按这里量出来的高度调整窗口，用量页因此永远不需要滚动；
// 附加平台虽保留额度曲线，但没有 Token 区，也不会留下一大片空白。
const PANEL_HEIGHT_SETTLE_MS = 100;
const PANEL_INITIAL_READY_MIN_WAIT_MS = 220;
const PANEL_INITIAL_READY_MAX_WAIT_MS = 3200;
const PANEL_INITIAL_READY_POLL_MS = 45;
// 切平台/切页时内容会经过「刷新中」的中间态，高度和稳定后差十几像素。
// 动画期间不上报，等这段过去再量一次，避免面板在切换过程中被反复 setBounds。
const PANEL_HEIGHT_SWITCH_HOLD_MS = 180;
let reportedPanelHeight = 0;
let panelHeightFrame = null;
let panelHeightSettleTimer = null;
let panelHeightHoldUntil = 0;
let initialReadyStartedAt = 0;
let initialReadyTimer = null;
let initialMeasuredHeight = 0;
let initialStableMeasurements = 0;

function hasSettledInitialContent() {
  if (!currentState) return false;
  const slices = activeSlices(currentState);
  const visibleSlices = (els.panel?.dataset.activeTab || 'usage') === 'radar'
    ? [slices.radar]
    : [slices.usage, slices.activity];
  return visibleSlices.every((slice) => (
    slice
    && !['loading', 'refreshing', 'idle'].includes(slice.status)
    && (slice.data !== null || slice.status === 'error')
  ));
}

function scheduleRendererReady() {
  if (rendererReadySent || initialReadyTimer) return;
  if (!initialReadyStartedAt) initialReadyStartedAt = performance.now();

  const check = () => {
    initialReadyTimer = null;
    if (rendererReadySent) return;
    const elapsed = performance.now() - initialReadyStartedAt;
    const measured = measurePanelHeight();
    if (measured > 0) {
      if (Math.abs(measured - initialMeasuredHeight) < 3) initialStableMeasurements += 1;
      else initialStableMeasurements = 1;
      initialMeasuredHeight = measured;
    }
    const heightStable = initialStableMeasurements >= 2;
    if (elapsed < PANEL_INITIAL_READY_MIN_WAIT_MS
      || (!hasSettledInitialContent() && elapsed < PANEL_INITIAL_READY_MAX_WAIT_MS)
      || (!heightStable && elapsed < PANEL_INITIAL_READY_MAX_WAIT_MS)) {
      initialReadyTimer = window.setTimeout(check, PANEL_INITIAL_READY_POLL_MS);
      return;
    }

    // 先让最终内容完成一次布局，再允许主进程显示窗口；这样首开使用的是最终高度，
    // 而不是 idle/loading 状态下的临时高度。
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (rendererReadySent) return;
        rendererReadySent = true;
        const finalHeight = measurePanelHeight();
        reportPanelHeight({ force: true });
        window.codexMeter.markPanelReady(finalHeight);
      });
    });
  };

  initialReadyTimer = window.setTimeout(check, 0);
}

function measurePanelHeight() {
  const activePanel = els.panels.find((panel) => panel.classList.contains('active'));
  if (!activePanel) return 0;
  const styles = getComputedStyle(activePanel);
  const children = [...activePanel.children].filter((node) => node.offsetParent !== null || node.getClientRects().length);
  const top = activePanel.getBoundingClientRect().top;
  // 用最后一个可见子节点的底边算实际内容高度：scrollHeight 至少等于可视高度，
  // 面板变矮时它不会跟着变小，没法用来驱动收缩。
  const contentBottom = children.reduce((lowest, node) => {
    const bounds = node.getBoundingClientRect();
    return bounds.height ? Math.max(lowest, bounds.bottom - top) : lowest;
  }, 0);
  const content = contentBottom + parseFloat(styles.paddingBottom || 0) + activePanel.scrollTop;
  // 状态行现在放在工具栏的页签行里，工具栏高度已经包含它；只有不在其中时才单独计入。
  const chromeNodes = els.toolbar?.contains(els.statusLine) ? [els.toolbar] : [els.toolbar, els.statusLine];
  const chrome = chromeNodes.reduce((sum, node) => {
    if (!node) return sum;
    const nodeStyles = getComputedStyle(node);
    return sum + node.offsetHeight + parseFloat(nodeStyles.marginTop || 0) + parseFloat(nodeStyles.marginBottom || 0);
  }, 0);
  return Math.ceil(chrome + content);
}

function reportPanelHeight({ force = false } = {}) {
  if (!window.codexMeter?.reportPanelHeight) return;
  const measured = measurePanelHeight();
  if (!measured) return;
  // 始终使用当前可见内容的实际高度，避免展开过模型后切回智力页仍保留大片空白。
  const height = measured;
  if (!force && Math.abs(height - reportedPanelHeight) < 3) return;
  reportedPanelHeight = height;
  window.codexMeter.reportPanelHeight(height);
}

function queuePanelHeightReport({ hold = 0 } = {}) {
  if (!window.codexMeter?.reportPanelHeight) return;
  const now = performance.now();
  if (hold) panelHeightHoldUntil = Math.max(panelHeightHoldUntil, now + hold);

  // 首帧要立刻定尺寸，否则面板会用默认高度闪一下。
  if (!reportedPanelHeight) {
    if (panelHeightFrame) window.cancelAnimationFrame(panelHeightFrame);
    panelHeightFrame = window.requestAnimationFrame(() => {
      panelHeightFrame = null;
      reportPanelHeight();
    });
  }

  window.clearTimeout(panelHeightSettleTimer);
  panelHeightSettleTimer = window.setTimeout(
    reportPanelHeight,
    Math.max(PANEL_HEIGHT_SETTLE_MS, panelHeightHoldUntil - now)
  );
}

function setActiveTab(tab, {
  provider = currentProviderKey(),
  animate = true,
  renderContent = true
} = {}) {
  tabByProvider[provider] = tab;
  const changed = els.panel && els.panel.dataset.activeTab !== tab;
  if (els.panel) els.panel.dataset.activeTab = tab;
  hideChartTooltip();
  els.tabs.forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  els.panels.forEach((panel) => panel.classList.toggle('active', panel.id === `${tab}Panel`));
  if (tab === 'radar' && changed) {
    setActiveRadarView(defaultRadarView(provider), {
      provider,
      animate: false,
      renderContent: false
    });
  }
  if (changed && renderContent && currentState) renderVisibleContent(currentState, tab);
  if (changed && animate) {
    revealActivePanel({ details: false });
    playTabSwitchEffect();
  }
  queuePanelHeightReport(changed ? { hold: PANEL_HEIGHT_SWITCH_HOLD_MS } : {});
}

// 雷达数据源下线时智力页没有内容可看，直接落在仍然有数据的「重置」页。
function defaultRadarView(provider) {
  if (!currentState || provider !== currentState.provider) return 'intelligence';
  const radar = activeSlices(currentState).radar;
  return radar?.status === 'error' && !radar.data ? 'reset' : 'intelligence';
}

function setActiveRadarView(view, {
  provider = currentProviderKey(),
  animate = true,
  renderContent = true
} = {}) {
  const allowedViews = ['intelligence', 'quota', 'reset'];
  const nextView = allowedViews.includes(view) ? view : 'intelligence';
  const changed = els.radarPanel?.dataset.radarView !== nextView;
  radarViewByProvider[provider] = nextView;
  if (els.radarPanel) els.radarPanel.dataset.radarView = nextView;
  els.radarSubtabs.forEach((button) => {
    const active = button.dataset.radarView === nextView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  els.radarViews.forEach((panel) => {
    const active = panel.dataset.radarView === nextView;
    panel.classList.toggle('active', active);
    panel.setAttribute('aria-hidden', String(!active));
  });
  if (changed && renderContent && currentState) renderRadarView(currentState, nextView, provider);
  if (changed && animate) {
    revealActivePanel({ details: false });
    playTabSwitchEffect();
  }
  queuePanelHeightReport(changed ? { hold: PANEL_HEIGHT_SWITCH_HOLD_MS } : {});
}

function renderRadarView(stateValue, view, provider = stateValue.provider || 'codex') {
  const slices = activeSlices(stateValue);
  if (view === 'quota') {
    renderSection('quota', [slices.radar, slices.activity?.data], () => renderQuota(slices.radar, provider, slices.activity));
    return;
  }
  if (view === 'reset') {
    renderSection('reset', [slices.usage, slices.radar, Math.floor(Date.now() / 30_000)], () => renderResetCards(stateValue, provider));
    return;
  }
  renderSection('iq', [slices.radar, slices.service?.data, radarSortByProvider[provider], radarExpandedByProvider[provider], radarLatestByProvider[provider]], () => renderIq(slices.radar, provider));
}

function handlePanelWheel(event) {
  const activePanel = els.panels.find((panel) => panel.classList.contains('active'));
  if (!activePanel || activePanel.scrollHeight <= activePanel.clientHeight + 2) return;
  const atBottom = activePanel.scrollTop + activePanel.clientHeight >= activePanel.scrollHeight - 2;
  const atTop = activePanel.scrollTop <= 0;

  if (scrollEdgeLock === 'bottom' && (!atBottom || event.deltaY < 0)) scrollEdgeLock = null;
  if (scrollEdgeLock === 'top' && (!atTop || event.deltaY > 0)) scrollEdgeLock = null;

  if (event.deltaY > 0 && atBottom) triggerScrollBounce('bottom');
  if (event.deltaY < 0 && atTop) triggerScrollBounce('top');
}

function triggerScrollBounce(edge) {
  const activePanel = els.panels.find((panel) => panel.classList.contains('active'));
  if (!activePanel) return;
  if (scrollEdgeLock === edge) return;
  scrollEdgeLock = edge;
  if (reduceMotion.matches) return;
  const offset = edge === 'top' ? 2 : -2;
  activePanel.animate([
    { transform: 'translateY(0)' },
    { transform: `translateY(${offset}px)`, offset: 0.42 },
    { transform: 'translateY(0)' }
  ], { duration: 260, easing: 'ease-out' });
}

function render(state) {
  const previousProvider = currentState?.provider;
  currentState = state;
  const nextLanguage = I18N.normalizeLanguage(state.language);
  const languageChanged = !previousProvider || lang !== nextLanguage;
  lang = nextLanguage;
  document.documentElement.lang = lang;
  if (languageChanged) applyStaticText();
  const provider = state.provider || 'codex';
  const isExtra = EXTRA_PROVIDER_IDS.includes(provider);
  els.panel.classList.toggle('extra-provider', isExtra);
  if (previousProvider && previousProvider !== provider) {
    setActiveTab('usage', { provider, animate: false, renderContent: false });
  } else if (isExtra && els.panel.dataset.activeTab === 'radar') {
    setActiveTab('usage', { provider, animate: false, renderContent: false });
  }
  syncProviderUi(provider);
  const slices = activeSlices(state);
  renderHeader(slices);
  renderVisibleContent(state, els.panel.dataset.activeTab || 'usage', slices);
  restoreDisclosures();
  const providerChanged = Boolean(previousProvider) && previousProvider !== provider;
  if (providerChanged) {
    revealActivePanel({ celebrate: true, details: false });
    playProviderSwitchEffect(previousProvider, provider);
  }
  queuePanelHeightReport(providerChanged ? { hold: PANEL_HEIGHT_SWITCH_HOLD_MS } : {});
}

function renderVisibleContent(stateValue, tab, providedSlices = null) {
  const provider = stateValue.provider || 'codex';
  const isExtra = EXTRA_PROVIDER_IDS.includes(provider);
  const slices = providedSlices || activeSlices(stateValue);
  if (tab === 'usage') {
    const clockBucket = Math.floor(Date.now() / 30_000);
    renderSection('meters', [slices.usage, slices.activity?.data?.windows, clockBucket, claudeReconnect], () => renderMeters(slices.usage, provider, slices.activity));
    const trendHistory = trendRange === 'week' ? stateValue.usageHistoryWeek?.[provider] : stateValue.usageHistory?.[provider];
    renderSection('trend', [slices.usage, trendRange, trendHistory, clockBucket], () => renderTrend(stateValue, slices.usage, provider));
    if (!isExtra) renderSection('tokens', [slices.activity, activeTokenDay, formatIsoDate(new Date()), tokenRange], () => renderTokenActivity(slices.activity));
    return;
  }
  if (!isExtra) {
    const view = radarViewByProvider[provider] || 'intelligence';
    setActiveRadarView(view, {
      provider,
      animate: false,
      renderContent: false
    });
    renderRadarView(stateValue, view, provider);
  }
}

// ---- 额度曲线 + 节奏 ----

const PACE = window.CMM_PACE;
// 7 天直方图的分组、分段和型号写法在 src/mobile/token-week.js，手机页共用同一份。
const TOKEN_WEEK = window.CMM_TOKEN_WEEK;
const TOKEN_WEEK_DAYS = TOKEN_WEEK.WEEK_DAYS;
const TREND_W = 372;
const TREND_H = 92;
const TREND_PLOT = Object.freeze({ left: 34, right: 7, top: 11, bottom: 19 });
// 24 小时看 5 小时窗口的锯齿，7 天看周窗口的走势；7 天视图是按小时压缩过的样本。
const TREND_RANGES = Object.freeze({
  day: {
    spanMs: 24 * 3600_000,
    gapMs: 45 * 60_000,
    ticks: [[0, 'trendX24h', 'start'], [0.5, 'trendX12h', 'middle'], [1, 'trendXNow', 'end']]
  },
  week: {
    spanMs: 7 * 24 * 3600_000,
    gapMs: 4 * 3600_000,
    ticks: [[0, 'trendX7d', 'start'], [4 / 7, 'trendX3d', 'middle'], [1, 'trendXNow', 'end']]
  }
});
const TREND_RANGE_STORAGE_KEY = 'cmm.trendRange';
let trendRange = readTrendRange();
let trendModel = null;

function readTrendRange() {
  try {
    return window.localStorage.getItem(TREND_RANGE_STORAGE_KEY) === 'week' ? 'week' : 'day';
  } catch {
    return 'day';
  }
}

function setTrendRange(range) {
  const next = range === 'week' ? 'week' : 'day';
  if (next === trendRange) return;
  trendRange = next;
  try {
    window.localStorage.setItem(TREND_RANGE_STORAGE_KEY, next);
  } catch {
    // 存储不可用时只在本次打开期间生效。
  }
  if (currentState) renderVisibleContent(currentState, 'usage');
  queuePanelHeightReport({ hold: 120 });
}

els.trendLegend?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-trend-range]');
  if (!button || !els.trendLegend.contains(button)) return;
  event.preventDefault();
  setTrendRange(button.dataset.trendRange);
});

// 曲线里的序列：5 小时、周额度，再加第一项按模型的周限额（例如 Fable）。
function trendSeriesFor(usage, provider, samples) {
  const series = [];
  if (!usage?.fiveHourUnlimited) {
    series.push({ key: 'five', paceKey: 'five', label: T('windowName5h'), tone: 'five', pick: (s) => s.five, window: usage?.primaryWindow });
  }
  series.push({ key: 'week', paceKey: 'week', label: T('windowNameWeek'), tone: 'week', pick: (s) => s.week, window: usage?.secondaryWindow });
  const scoped = EXTRA_PROVIDER_IDS.includes(provider)
    ? null
    : (usage?.extraWindows || []).find((windowValue) => windowValue && !windowValue.inactive && String(windowValue.name || '').trim());
  if (scoped) {
    const name = String(scoped.name).trim();
    series.push({ key: `extra:${name}`, paceKey: `extra:${name}`, label: name, tone: 'scoped', pick: (s) => s.ex?.[name], window: scoped });
  }
  return series.map((item) => ({
    ...item,
    points: samples
      .map((sample) => ({ t: Number(sample.t), v: item.pick(sample) }))
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v))
  }));
}

// 匀速参考线：当前窗口从开始（0%）到重置（100%）匀速用完时，此刻应该用到哪。
// 周额度和同一时刻重置的专项限额共用一条，避免两条虚线叠在一起。
function trendPaceGuides(series, provider, start, now) {
  const seen = new Set();
  const guides = [];
  for (const item of series) {
    if (!item.points.length) continue;
    const durationMs = PACE?.windowDurationMs(item.paceKey, provider);
    const resetAt = Number(item.window?.resetAt);
    if (!durationMs || !resetAt || resetAt <= now) continue;
    const startAt = resetAt - durationMs;
    const signature = `${Math.round(startAt / 60_000)}:${durationMs}`;
    if (seen.has(signature)) {
      guides.find((guide) => guide.signature === signature)?.labels.push(item.label);
      continue;
    }
    seen.add(signature);
    const from = Math.max(start, startAt);
    if (from >= now) continue;
    guides.push({ signature, tone: item.tone, labels: [item.label], from, to: now, startAt, durationMs });
  }
  return guides;
}

function paceGuideValue(guide, timestamp) {
  if (!guide || timestamp < guide.from || timestamp > guide.to + 60_000) return null;
  return clamp(((timestamp - guide.startAt) / guide.durationMs) * 100, 0, 100);
}

function renderTrend(state, usageState, provider) {
  if (!els.usageTrend) return;
  const range = TREND_RANGES[trendRange] || TREND_RANGES.day;
  const source = trendRange === 'week' ? state.usageHistoryWeek?.[provider] : state.usageHistory?.[provider];
  const now = Date.now();
  const start = now - range.spanMs;
  const visible = (Array.isArray(source) ? source : []).filter((sample) => (
    Number.isFinite(Number(sample?.t))
    && Number(sample.t) >= start
    && Number(sample.t) <= now + 60_000
  ));
  const usage = usageState.data;
  const series = trendSeriesFor(usage, provider, visible);
  const ready = series.filter((item) => item.points.length >= 3);
  const guides = trendPaceGuides(ready, provider, start, now);
  trendModel = { now, start, range, series: ready, guides };

  if (els.trendLegend) {
    const legendItems = [];
    if (usage?.fiveHourUnlimited) {
      legendItems.push(`<span class="trend-legend-item unlimited" title="${escapeHtml(T('trendUnlimited', { window: T('windowName5h') }))}"><span class="trend-dot trend-dot-five"></span>${escapeHtml(T('windowName5h'))} ∞</span>`);
    }
    for (const item of series) {
      const sampleClass = item.points.length >= 3 ? '' : item.points.length ? ' sampling' : ' unavailable';
      const tip = item.points.length >= 3
        ? item.label
        : item.points.length
          ? T('trendSamplePending', { window: item.label, n: Math.min(3, item.points.length) })
          : T('trendUnavailable', { window: item.label });
      legendItems.push(`<span class="trend-legend-item${sampleClass}" title="${escapeHtml(tip)}"><span class="trend-dot trend-dot-${item.tone}"></span>${escapeHtml(item.label)}</span>`);
    }
    if (guides.length) {
      legendItems.push(`<span class="trend-legend-item trend-legend-pace" title="${escapeHtml(T('trendPaceTip'))}"><span class="trend-dash" aria-hidden="true"></span>${escapeHtml(T('trendPaceLegend'))}</span>`);
    }
    const rangeButton = (key, label) => `<button type="button" class="trend-range-button${trendRange === key ? ' active' : ''}" data-trend-range="${key}" aria-pressed="${trendRange === key}">${escapeHtml(label)}</button>`;
    updateHtml(els.trendLegend, `
      <span class="trend-legend-items">${legendItems.join('')}</span>
      <span class="trend-range" role="group" aria-label="${escapeHtml(T('trendRangeAria'))}">${rangeButton('day', T('trendRangeDay'))}${rangeButton('week', T('trendRangeWeek'))}</span>
    `);
  }

  const lines = trendPaceText(usage, provider, now);
  const noCurve = !ready.length;
  const pendingSamples = series
    .filter((item) => item.points.length < 3)
    .map((item) => T('trendSamplePending', { window: item.label, n: Math.min(3, item.points.length) }));
  const paths = ready.map((item) => trendPath(item.points, `trend-series trend-${item.tone}`, now, range)).join('');
  const guideLines = guides.map((guide) => {
    const fromValue = paceGuideValue(guide, guide.from);
    const toValue = paceGuideValue(guide, guide.to);
    return `<line class="trend-pace trend-pace-${guide.tone}" x1="${trendX(guide.from, now, range).toFixed(1)}" y1="${trendY(fromValue).toFixed(1)}" x2="${trendX(guide.to, now, range).toFixed(1)}" y2="${trendY(toValue).toFixed(1)}" />`;
  }).join('');
  const trendVisual = noCurve
    ? `
      <div class="trend-empty-state" role="status">
        <span class="trend-empty-spark" aria-hidden="true"><i></i><i></i><i></i></span>
        <div class="trend-empty-copy">
          <strong>${escapeHtml(T('trendEmpty'))}</strong>
          <span>${escapeHtml(pendingSamples.join(' · '))}</span>
        </div>
      </div>
    `
    : `
      <svg viewBox="0 0 ${TREND_W} ${TREND_H}" role="img" aria-label="${escapeHtml(T(trendRange === 'week' ? 'trendChartAriaWeek' : 'trendChartAria'))}">
        ${trendAxes(range)}
        ${guideLines}
        ${paths}
        <g class="trend-hover" aria-hidden="true" visibility="hidden">
          <line class="trend-crosshair" x1="0" y1="${TREND_PLOT.top}" x2="0" y2="${TREND_H - TREND_PLOT.bottom}" />
          ${ready.map((item) => `<circle class="trend-hover-dot trend-hover-${item.tone}" data-series="${escapeHtml(item.key)}" r="3.5" cx="0" cy="0" />`).join('')}
        </g>
        <rect class="trend-hit" x="${TREND_PLOT.left}" y="0" width="${TREND_W - TREND_PLOT.left - TREND_PLOT.right}" height="${TREND_H - TREND_PLOT.bottom + 4}" />
      </svg>
    `;
  updateHtml(els.usageTrend, `
    <section class="trend-card${noCurve ? ' trend-card-empty' : ''}">
      ${trendVisual}
      <div class="trend-lines">
        ${lines.map((line) => `<span class="trend-line">${line.tier && line.tier !== 'good' && line.tier !== 'neutral' ? `<i class="pace-icon tier-${line.tier}" aria-hidden="true">${line.tier === 'critical' ? '■' : '▲'}</i>` : ''}${escapeHtml(line.text)}</span>`).join('')}
      </div>
    </section>
  `);
}

// 曲线下方固定两行：5 小时一行，周额度与专项周限额里节奏最紧的一行；GPT 与 Claude 行数相同，展开后两边同高。
function trendPaceText(usage, provider, now) {
  if (!usage) return [{ text: T('trendUnavailable', { window: T('windowNameWeek') }) }];
  const entries = PACE ? PACE.listWindows(usage, { provider, now }) : [];
  const five = entries.find((entry) => entry.key === 'five');
  const weekly = PACE ? PACE.mostUrgent(entries.filter((entry) => entry.key !== 'five')) : null;
  const lines = [];
  if (usage.fiveHourUnlimited) lines.push({ text: T('trendUnlimited', { window: T('windowName5h') }) });
  else lines.push(five ? paceLine(five) : { text: T('trendUnavailable', { window: T('windowName5h') }) });
  lines.push(weekly ? paceLine(weekly) : { text: T('trendUnavailable', { window: T('windowNameWeek') }) });
  return lines;
}

function paceWindowLabel(entry) {
  if (entry.key === 'five') return T('windowName5h');
  if (entry.key === 'week') return T('windowNameWeek');
  return T('windowNameScoped', { name: entry.name || '' });
}

function paceLine(entry) {
  const pace = entry.pace;
  const window = paceWindowLabel(entry);
  if (!pace) return { text: T('trendUnavailable', { window }) };
  const delta = Math.round(Math.abs(pace.delta || 0));
  switch (pace.status) {
    case 'exhausted':
      return { text: T('paceExhausted', { window, time: formatResetClock(pace.resetAt) }), tier: 'critical' };
    case 'reset':
      return { text: T('paceResetPending', { window }), tier: 'neutral' };
    case 'early':
      return { text: T('paceEarly', { window }), tier: 'neutral' };
    case 'unknown':
    case 'idle':
      return { text: T('paceUnknown', { window }), tier: 'neutral' };
    default:
      break;
  }
  if (!pace.lastsUntilReset && pace.runOutAt) {
    return { text: T('paceRunOut', { window, delta, time: formatResetClock(pace.runOutAt) }), tier: pace.tier };
  }
  if (pace.status === 'behind') return { text: T('paceBehind', { window, delta }), tier: 'good' };
  return { text: T('paceSteady', { window }), tier: 'good' };
}

function trendY(usedPercent) {
  const usable = TREND_H - TREND_PLOT.top - TREND_PLOT.bottom;
  return TREND_PLOT.top + usable - (clamp(usedPercent, 0, 100) / 100) * usable;
}

function trendX(timestamp, now, range = TREND_RANGES.day) {
  const start = now - range.spanMs;
  const usable = TREND_W - TREND_PLOT.left - TREND_PLOT.right;
  return TREND_PLOT.left + clamp((timestamp - start) / range.spanMs, 0, 1) * usable;
}

function trendAxes(range = TREND_RANGES.day) {
  const plotRight = TREND_W - TREND_PLOT.right;
  const plotBottom = TREND_H - TREND_PLOT.bottom;
  const yTicks = [100, 50, 0].map((value) => {
    const y = trendY(value);
    return `
      <line class="trend-grid" x1="${TREND_PLOT.left}" y1="${y}" x2="${plotRight}" y2="${y}" />
      <text class="trend-axis-label trend-axis-y" x="${TREND_PLOT.left - 5}" y="${y + 3}" text-anchor="end">${value}</text>
    `;
  }).join('');
  const xTicks = range.ticks.map(([ratio, key, anchor]) => {
    const x = TREND_PLOT.left + ratio * (plotRight - TREND_PLOT.left);
    return `
      <line class="trend-axis-tick" x1="${x}" y1="${plotBottom}" x2="${x}" y2="${plotBottom + 3}" />
      <text class="trend-axis-label trend-axis-x" x="${x}" y="${TREND_H - 4}" text-anchor="${anchor}">${escapeHtml(T(key))}</text>
    `;
  }).join('');
  return `
    <text class="trend-axis-title" x="${TREND_PLOT.left}" y="8">${escapeHtml(T('trendYAxis'))}</text>
    ${yTicks}
    <line class="trend-axis" x1="${TREND_PLOT.left}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" />
    ${xTicks}
  `;
}

// Mac 睡眠时没有样本：相邻两点间隔超过 gapMs 就断开，不画一条横跨空白的直线。
function trendPath(points, className, now, range) {
  if (points.length < 2) return '';
  let d = '';
  let previous = null;
  for (const point of points) {
    const command = !previous || point.t - previous.t > range.gapMs ? 'M' : 'L';
    d += `${command}${trendX(point.t, now, range).toFixed(1)},${trendY(point.v).toFixed(1)}`;
    previous = point;
  }
  return `<path class="${className}" d="${d}" />`;
}

function nearestTrendPoint(points, timestamp, toleranceMs) {
  let best = null;
  for (const point of points) {
    const distance = Math.abs(point.t - timestamp);
    if (distance <= toleranceMs && (!best || distance < best.distance)) best = { point, distance };
  }
  return best?.point || null;
}

function handleTrendPointer(event) {
  const svg = event.target.closest?.('.trend-card svg');
  if (!svg || !trendModel?.series.length) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width) return;
  const x = ((event.clientX - rect.left) / rect.width) * TREND_W;
  const plotRight = TREND_W - TREND_PLOT.right;
  if (x < TREND_PLOT.left || x > plotRight) {
    hideTrendHover(svg);
    return;
  }
  const { now, range, series, guides } = trendModel;
  const timestamp = now - range.spanMs + ((x - TREND_PLOT.left) / (plotRight - TREND_PLOT.left)) * range.spanMs;
  const tolerance = range.gapMs;
  const rows = [];
  const hover = svg.querySelector('.trend-hover');
  const crosshair = svg.querySelector('.trend-crosshair');
  crosshair?.setAttribute('x1', x.toFixed(1));
  crosshair?.setAttribute('x2', x.toFixed(1));
  for (const item of series) {
    const point = nearestTrendPoint(item.points, timestamp, tolerance);
    const dot = svg.querySelector(`.trend-hover-dot[data-series="${CSS.escape(item.key)}"]`);
    if (!point) {
      dot?.setAttribute('visibility', 'hidden');
      continue;
    }
    dot?.setAttribute('visibility', 'visible');
    dot?.setAttribute('cx', trendX(point.t, now, range).toFixed(1));
    dot?.setAttribute('cy', trendY(point.v).toFixed(1));
    const guide = guides.find((candidate) => candidate.labels.includes(item.label));
    const expected = paceGuideValue(guide, point.t);
    rows.push(`
      <span class="trend-tip-row">
        <i class="trend-dot trend-dot-${item.tone}" aria-hidden="true"></i>
        <em>${escapeHtml(item.label)}</em>
        <b>${escapeHtml(`${Math.round(point.v)}%`)}</b>
        ${expected === null ? '' : `<small>${escapeHtml(T('trendTipPace', { v: Math.round(expected) }))}</small>`}
      </span>
    `);
  }
  if (!rows.length) {
    hideTrendHover(svg);
    return;
  }
  hover?.setAttribute('visibility', 'visible');
  showTrendTooltip(`<strong>${escapeHtml(formatTrendMoment(timestamp))}</strong>${rows.join('')}`, event);
}

function hideTrendHover(svg) {
  svg?.querySelector('.trend-hover')?.setAttribute('visibility', 'hidden');
  hideChartTooltip();
}

function formatTrendMoment(timestamp) {
  const options = trendRange === 'week'
    ? { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', hour12: false };
  return new Intl.DateTimeFormat(lang, options).format(timestamp);
}

els.usageTrend?.addEventListener('mousemove', handleTrendPointer);
els.usageTrend?.addEventListener('mouseleave', () => hideTrendHover(els.usageTrend.querySelector('.trend-card svg')));

function applyStaticText() {
  document.querySelectorAll('[data-ui-copy]').forEach((node) => { node.textContent = T(node.dataset.uiCopy); });
  if (els.tabUsageLabel) els.tabUsageLabel.textContent = T('tabUsage');
  if (els.tabRadarLabel) els.tabRadarLabel.textContent = T('tabRadar');
  if (els.radarTabIntelligence) els.radarTabIntelligence.textContent = T('radarSubtabIntelligence');
  if (els.radarTabQuota) els.radarTabQuota.textContent = T('radarSubtabQuota');
  if (els.radarTabReset) els.radarTabReset.textContent = T('radarSubtabReset');
  if (els.recommendedTitle) els.recommendedTitle.textContent = T('recommendedModel');
  if (els.iqDegradeTitle) els.iqDegradeTitle.textContent = T('degradationAlert');
  if (els.modelUsageTitle) els.modelUsageTitle.textContent = T('modelUsageTitle');
  if (els.modelUsagePeriod) els.modelUsagePeriod.textContent = T('modelUsagePeriod');
  if (els.tokenTitle) els.tokenTitle.textContent = T('tokenTitle');
  if (els.trendTitle) els.trendTitle.textContent = T('trendTitle');
  if (els.iqTitle) els.iqTitle.textContent = T('iqModelsTitle');
  if (els.quotaRadarTitle) els.quotaRadarTitle.textContent = T('quotaRadarTitle');
  if (els.openRadar) els.openRadar.textContent = T(currentProviderKey() === 'claude' ? 'openOfficialUsage' : 'openSource');
  const sortLabels = {
    iq: 'iqSortIq',
    value: 'iqSortValue',
    speed: 'iqSortSpeed'
  };
  const activeSort = radarSortByProvider[currentProviderKey()] || 'iq';
  els.iqSortButtons.forEach((button) => {
    const key = sortLabels[button.dataset.iqSort];
    if (key) button.textContent = `${T(key)}${button.dataset.iqSort === activeSort ? sortDirectionMark(activeSort) : ''}`;
  });
}

function sortDirectionMark(sort) {
  return sort === 'speed' ? ' ↑' : ' ↓';
}

function renderHeader(slices) {
  const usage = slices.usage;
  const radar = slices.radar;
  const token = slices.activity;
  const statusParts = [];
  if (usage.status === 'ok') statusParts.push(statusPart(T('statusUsage', { time: formatClock(usage.fetchedAt) }), 'good'));
  if (usage.status === 'loading') statusParts.push(statusPart(T('statusUsageLoading'), 'loading'));
  if (usage.status === 'refreshing') statusParts.push(statusPart(T('statusUsageRefreshing'), 'loading'));
  if (usage.status === 'error') statusParts.push(statusPart(usage.error || T('statusUsageFailed'), 'danger'));
  if (token.status === 'ok') statusParts.push(statusPart(T('statusToken', { time: formatClock(token.fetchedAt) }), 'good'));
  if (radar.status === 'ok') statusParts.push(statusPart(T('statusRadar', { time: formatClock(radar.fetchedAt) }), 'info'));
  if (radar.status === 'loading') statusParts.push(statusPart(T('statusRadarLoading'), 'loading'));
  if (radar.status === 'refreshing') statusParts.push(statusPart(T('statusRadarRefreshing'), 'loading'));
  // 雷达数据源下线不是本机故障：单独标成「暂不可用」，不算进读取异常，也不把状态行染红。
  const radarPaused = radar.status === 'error' && radar.errorCode === RADAR_PAUSED_CODE;
  if (radarPaused) statusParts.push(statusPart(T('radarPaused'), 'neutral'));
  else if (radar.status === 'error') statusParts.push(statusPart(radar.error || T('statusRadarFailed'), 'danger'));
  const service = serviceStatusSummary(slices.service);
  if (service) statusParts.push(statusPart(service.text, service.tone, service.home));
  const errors = [usage, radar, token].filter((slice) => slice.status === 'error' && !(slice === radar && radarPaused)).length;
  const loading = [usage, radar, token].some((slice) => ['loading', 'refreshing'].includes(slice.status));
  const fetchedAt = [usage, radar, token].map((slice) => slice.fetchedAt).filter(Boolean).sort().at(-1);
  // 官方故障优先于「已更新」：本机读数正常也可能是服务端出了问题。
  const outage = service && service.level !== 'none' && service.level !== 'maintenance';
  const brief = errors ? T('statusCompactError', { n: errors })
    : outage ? service.brief
      : loading ? T('statusCompactLoading')
        : fetchedAt ? T('statusCompactOk', { time: formatShortTime(fetchedAt) }) : T('statusWaiting');
  const briefTone = errors ? 'danger' : outage ? service.tone : loading ? 'loading' : 'good';
  updateHtml(els.statusLine, `<details class="inline-details sync-details" data-detail="sync-status">
    <summary>${statusPart(brief, briefTone)}</summary>
    <div class="disclosure-content">${statusParts.join('') || statusPart(T('statusWaiting'), 'neutral')}</div>
  </details>`);
}

function statusPart(text, tone, href = '') {
  if (href) {
    return `<button type="button" class="status-item status-link ${tone}" data-open-url="${escapeHtml(href)}"><i aria-hidden="true"></i>${escapeHtml(text)}</button>`;
  }
  return `<span class="status-item ${tone}"><i aria-hidden="true"></i>${escapeHtml(text)}</span>`;
}

// 官方状态页（只看本应用相关的组件）：正常时只在展开的状态里列一行，有故障才上到摘要。
const SERVICE_LEVEL_TONE = { none: 'good', maintenance: 'info', minor: 'warning', major: 'danger', critical: 'danger' };

function serviceStatusSummary(slice) {
  const data = slice?.data;
  if (!data || !data.level) return null;
  const level = SERVICE_LEVEL_TONE[data.level] ? data.level : 'none';
  const name = currentProviderKey() === 'claude' ? 'Claude' : 'OpenAI';
  const affected = (data.components || []).filter((item) => item.level && item.level !== 'none').map((item) => item.name);
  const detail = data.incidents?.[0]?.name || affected.join(' / ');
  const levelText = T(`serviceLevel_${level}`);
  return {
    level,
    tone: SERVICE_LEVEL_TONE[level],
    home: typeof data.home === 'string' && data.home.startsWith('https://') ? data.home : '',
    text: detail && level !== 'none'
      ? T('serviceStatusDetail', { name, level: levelText, detail })
      : T('serviceStatusLine', { name, level: levelText }),
    brief: T('serviceStatusBrief', { name, level: levelText })
  };
}

els.statusLine?.addEventListener('click', (event) => {
  const link = event.target.closest('[data-open-url]');
  if (!link || !els.statusLine.contains(link)) return;
  event.preventDefault();
  window.codexMeter.openExternal(link.dataset.openUrl);
});

function renderMeters(usageState, provider, activityState) {
  const usage = usageState.data;
  const activityWindows = activityState?.data?.windows || {};
  const isExtra = EXTRA_PROVIDER_IDS.includes(provider);
  if (els.usageTitle) {
    const planLabel = provider === 'claude' && usage?.planType ? ` · ${formatPlanType(usage.planType)}` : '';
    const title = isExtra
      ? T('usageTitleExtra', { name: EXTRA_PROVIDER_NAMES[provider] })
      : provider === 'claude' ? T('usageTitleClaude') : T('usageTitleCodex');
    els.usageTitle.textContent = title + planLabel;
  }
  const officialSuffix = provider === 'claude' && usage ? T('officialSuffix') : '';
  // 刷新失败或睡眠后没刷到：数字照常显示，但标明数据截至何时，避免把旧数字当成实时。
  const stale = Boolean(usage) && (usageState.status === 'error' || PACE?.isStale(usageState.fetchedAt, usageState.staleAfterMs));
  const retry = Number(usageState.retryAt) > Date.now() ? T('retryAt', { time: formatResetClock(usageState.retryAt) }) : '';
  els.usageUpdated.textContent = usageState.fetchedAt
    ? stale
      ? `${T('dataAsOf', { time: formatShortTime(usageState.fetchedAt) })}${retry ? ` · ${retry}` : ''}`
      : `${T('updatedAt', { time: formatShortTime(usageState.fetchedAt) })}${officialSuffix}`
    : '';
  els.usageUpdated.classList.toggle('stale', stale);
  els.usageUpdated.title = stale
    ? [usageState.error || T('dataStaleTip'), retry].filter(Boolean).join(' · ')
    : provider === 'claude' && usage ? T('officialTip') : '';
  if (!usage) {
    const reconnect = provider === 'claude' && CLAUDE_RECONNECT_CODES.includes(usageState.errorCode);
    if (!reconnect) claudeReconnect = { pending: false, failed: '' };
    updateHtml(els.meters, reconnect
      ? claudeConnectTemplate(usageState.errorCode)
      : emptyBlock(usageState.error || T('noUsageData')));
    return;
  }
  claudeReconnect = { pending: false, failed: '' };

  const cards = [];
  const scopedWindows = isExtra ? [] : (usage.extraWindows || []);
  const foldedScopedWindow = scopedWindows.length === 1 && usage.secondaryWindow && String(scopedWindows[0].name || '').trim()
    ? scopedWindows[0]
    : null;
  if (usage.fiveHourUnlimited) {
    cards.push(unlimitedCardTemplate(T('label5h'), activityWindows.fiveHour, 'fiveHour'));
  } else if (usage.primaryWindow || !isExtra) {
    cards.push(quotaCardTemplate(usage.primaryWindow, T('label5h'), {
      provider,
      activityWindow: activityWindows.fiveHour,
      activityWindowKey: 'fiveHour'
    }));
  }
  if (usage.secondaryWindow || !isExtra) {
    cards.push(quotaCardTemplate(usage.secondaryWindow, T('labelWeek'), {
      provider,
      activityWindow: activityWindows.week,
      activityWindowKey: 'week',
      scopedWindow: foldedScopedWindow
    }));
  }
  // 附加平台的额外窗口本身就是主要信息，保持整张卡。GPT / Claude 的专项周限额（例如 Fable）
  // 是补充信息：只有一项时并进「一周」卡、放在大数字右侧（1.1.0 起，手机页同样），不占高度，
  // GPT 与 Claude 的用量页因此同高、切换时窗口尺寸不动；多于一项才在卡片下方逐行列出。
  const slimRows = [];
  (usage.extraWindows || []).forEach((windowValue) => {
    if (isExtra) {
      cards.push(quotaCardTemplate(windowValue, String(windowValue.name || '').trim() || T('labelWeek'), { provider }));
    } else if (windowValue !== foldedScopedWindow) {
      slimRows.push(quotaSlimRowTemplate(windowValue, scopedWindowLabel(windowValue)));
    }
  });
  const markup = cards.length || slimRows.length
    ? `${cards.join('')}${slimRows.length ? `<div class="quota-slim-rows">${slimRows.join('')}</div>` : ''}`
    : emptyBlock(T('windowUnavailable'));
  if (updateHtml(els.meters, markup)) animateQuotaNumbers();
}

// Claude 断连（未登录 / 登录过期）时不显示一行报错，而是给出原因和一键重连。
const CLAUDE_RECONNECT_CODES = ['claude-auth-expired', 'claude-no-creds'];
let claudeReconnect = { pending: false, failed: '' };

function claudeConnectTemplate(errorCode) {
  const missing = errorCode === 'claude-no-creds';
  const title = T(missing ? 'claudeConnectTitleMissing' : 'claudeConnectTitleExpired');
  const body = claudeReconnect.failed
    || (claudeReconnect.pending ? T('claudeConnectWaitingHint') : T(missing ? 'claudeConnectBodyMissing' : 'claudeConnectBodyExpired'));
  const action = claudeReconnect.pending
    ? T('claudeConnectWaiting')
    : T(missing ? 'claudeConnectActionMissing' : 'claudeConnectAction');
  return `
    <article class="connect-card${claudeReconnect.pending ? ' pending' : ''}" role="group" aria-label="${escapeHtml(title)}">
      <span class="connect-glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 14a4.5 4.5 0 0 0 6.4.3l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
          <path d="M14 10a4.5 4.5 0 0 0-6.4-.3l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
        </svg>
      </span>
      <div class="connect-copy">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
      </div>
      <button class="connect-action" type="button" data-action="claude-reconnect"${claudeReconnect.pending ? ' disabled' : ''}>
        ${claudeReconnect.pending ? '<i class="connect-spinner" aria-hidden="true"></i>' : ''}<span>${escapeHtml(action)}</span>
      </button>
    </article>
  `;
}

async function handleClaudeReconnect() {
  if (claudeReconnect.pending) return;
  claudeReconnect = { pending: true, failed: '' };
  if (currentState) requestRender(currentState);
  let result = null;
  try {
    result = await window.codexMeter.reconnectClaude?.();
  } catch (error) {
    result = { ok: false, error: error?.message };
  }
  if (!result?.ok) {
    claudeReconnect = {
      pending: false,
      failed: T('claudeConnectFailed', { command: result?.command || 'claude auth login --claudeai' })
    };
    if (currentState) requestRender(currentState);
  }
}

function formatPlanType(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function quotaCardTemplate(windowValue, label, {
  provider = 'codex',
  activityWindow = null,
  activityWindowKey = null,
  scopedWindow = null
} = {}) {
  if (!windowValue) return emptyBlock(T('windowUnavailable'));
  const remaining = Number.isFinite(Number(windowValue.remainingPercent))
    ? clamp(Math.round(Number(windowValue.remainingPercent)), 0, 100)
    : 0;
  const inactive = provider === 'claude' && windowValue.inactive;
  const critical = !inactive && remaining <= 10;
  const pace = inactive ? null : windowPace(windowValue, paceKeyForWindow(activityWindowKey, windowValue), provider);
  const footer = windowValue.resetAt
    ? formatReset(windowValue.resetAt)
    : inactive
      ? T('inactiveFooter')
      : T('noResetFooter');
  const windowClass = quotaWindowClass(activityWindowKey);
  const windowMark = quotaWindowMark(activityWindowKey);
  const windowTitle = T('remainingTitle', { label });
  const paceClass = !critical && pace?.tier === 'serious' ? ' pace-serious' : '';
  const badge = paceBadgeTemplate(pace);
  return `
    <article class="quota-card ${windowClass}${critical ? ' critical' : ''}${paceClass}${scopedWindow ? ' has-scoped' : ''}" style="--quota-percent:${remaining}%;">
      <div class="quota-card-top">
        <span class="quota-window-title" title="${escapeHtml(T('remainingTitle', { label }))}">
          <i class="quota-window-mark" aria-hidden="true">${escapeHtml(windowMark)}</i>
          <span>${escapeHtml(windowTitle)}</span>
        </span>
      </div>
      <strong class="quota-remaining-value" data-quota-key="${escapeHtml(`${provider}:${label}`)}" data-quota-value="${remaining}">${remaining}%</strong>
      ${scopedWindow ? quotaScopedStatTemplate(scopedWindow, provider) : ''}
      <div class="quota-progress" aria-hidden="true"${pace?.ready ? ` title="${escapeHtml(paceTickTip(pace))}"` : ''}>
        <i></i>
        ${paceTickTemplate(pace)}
        ${scopedWindow ? quotaScopedLaneTemplate(scopedWindow, provider) : ''}
        <span class="quota-flare"></span>
      </div>
      <small class="quota-foot${badge ? ' has-pace' : ''}"><span class="quota-foot-text">${escapeHtml(footer)}</span>${badge}</small>
      ${quotaActivityTemplate(activityWindowKey, activityWindow)}
    </article>
  `;
}

function scopedWindowLabel(windowValue) {
  const name = String(windowValue?.name || '').trim();
  return name ? `${T('labelWeek')} · ${name}` : T('labelWeek');
}

// 「一周」卡里的专项限额（1.1.0）：大数字右侧上面名称、下面剩余百分比，进度条下面多一道细条，
// 都用曲线里同一种颜色。它自己的重置时间和节奏放在悬停提示里；节奏偏快时名称前加一个状态图标，颜色只落在图标上。
function scopedWindowState(windowValue, provider) {
  const remaining = Number.isFinite(Number(windowValue.remainingPercent))
    ? clamp(Math.round(Number(windowValue.remainingPercent)), 0, 100)
    : 0;
  const critical = !windowValue.inactive && remaining <= 10;
  const pace = windowValue.inactive ? null : windowPace(windowValue, paceKeyForWindow(null, windowValue), provider);
  return { remaining, critical, pace };
}

function quotaScopedStatTemplate(windowValue, provider = 'claude') {
  const { remaining, critical, pace } = scopedWindowState(windowValue, provider);
  const reset = windowValue.resetAt
    ? formatReset(windowValue.resetAt)
    : windowValue.inactive ? T('inactiveFooter') : T('noResetFooter');
  const title = `${T('remainingTitle', { label: scopedWindowLabel(windowValue) })} ${remaining}%`;
  const tipParts = [title, reset];
  if (pace?.ready) tipParts.push(paceTickTip(pace));
  const tier = !critical && ['warning', 'serious'].includes(pace?.tier) ? pace.tier : '';
  const icon = tier ? `<i class="pace-icon tier-${tier}" aria-label="${escapeHtml(T('paceAheadShort'))}">▲</i>` : '';
  return `<span class="quota-scoped-stat${critical ? ' critical' : ''}" role="img" title="${escapeHtml(tipParts.join(' · '))}" aria-label="${escapeHtml(tipParts.join(' · '))}"><span class="quota-scoped-name">${icon}${escapeHtml(String(windowValue.name).trim())}</span><b>${remaining}%</b></span>`;
}

// 进度条下面那一道：专项限额自己的剩余，和上面的一周共用一个圆角外框；匀速刻度只画在上面那道。
function quotaScopedLaneTemplate(windowValue, provider = 'claude') {
  const { remaining, critical, pace } = scopedWindowState(windowValue, provider);
  const serious = !critical && pace?.tier === 'serious';
  return `<span class="quota-scoped-lane${critical ? ' critical' : ''}${serious ? ' pace-serious' : ''}" style="--scoped-percent:${remaining}%;"><span class="quota-scoped-fill"></span></span>`;
}

// ---- 节奏刻度 ----
// 进度条显示的是「剩余」，所以匀速刻度放在「按匀速此刻应剩」的位置：填充短于刻度就是用得比匀速快。

function paceKeyForWindow(activityWindowKey, windowValue) {
  if (activityWindowKey === 'fiveHour') return 'five';
  if (activityWindowKey === 'week') return 'week';
  return `extra:${String(windowValue?.name || '').trim() || 'limit'}`;
}

function windowPace(windowValue, paceKey, provider) {
  if (!PACE || !windowValue) return null;
  return PACE.computePace(windowValue, { durationMs: PACE.windowDurationMs(paceKey, provider) });
}

function paceTickTemplate(pace) {
  if (!pace?.ready || pace.elapsedPercent === null) return '';
  const left = clamp(100 - pace.elapsedPercent, 0, 100);
  return `<span class="quota-pace-tick" style="--pace-left:${left.toFixed(1)}%;"></span>`;
}

function paceTickTip(pace) {
  const expected = Math.round(clamp(100 - pace.elapsedPercent, 0, 100));
  if (!pace.lastsUntilReset && pace.runOutAt) {
    return T('paceTickTipAhead', { v: expected, delta: Math.round(Math.abs(pace.delta)), time: formatResetClock(pace.runOutAt) });
  }
  return T('paceTickTip', { v: expected });
}

function paceBadgeTemplate(pace) {
  if (!pace?.ready || !['warning', 'serious'].includes(pace.tier)) return '';
  const delta = Math.round(Math.abs(pace.delta));
  return `<em class="pace-badge" title="${escapeHtml(paceTickTip(pace))}"><i class="pace-icon tier-${pace.tier}" aria-hidden="true">▲</i>${escapeHtml(T('paceAheadBadge', { delta }))}</em>`;
}

function quotaSlimRowTemplate(windowValue, label) {
  const remaining = Number.isFinite(Number(windowValue.remainingPercent))
    ? clamp(Math.round(Number(windowValue.remainingPercent)), 0, 100)
    : 0;
  const critical = !windowValue.inactive && remaining <= 10;
  const pace = windowValue.inactive ? null : windowPace(windowValue, paceKeyForWindow(null, windowValue), currentProviderKey());
  const footer = windowValue.resetAt
    ? formatReset(windowValue.resetAt)
    : windowValue.inactive ? T('inactiveFooter') : T('noResetFooter');
  return `
    <div class="quota-slim-row${critical ? ' critical' : ''}${!critical && pace?.tier === 'serious' ? ' pace-serious' : ''}" style="--quota-percent:${remaining}%;"${pace?.ready ? ` title="${escapeHtml(paceTickTip(pace))}"` : ''}>
      <span class="quota-slim-name">${escapeHtml(T('remainingTitle', { label }))}</span>
      <span class="quota-slim-bar" aria-hidden="true"><i></i>${paceTickTemplate(pace)}</span>
      <strong>${remaining}%</strong>
      <small>${escapeHtml(footer)}</small>
    </div>
  `;
}

function quotaWindowClass(windowKey) {
  if (windowKey === 'fiveHour') return 'quota-card-five-hour';
  if (windowKey === 'week') return 'quota-card-week';
  return 'quota-card-extra';
}

function quotaWindowMark(windowKey) {
  if (windowKey === 'fiveHour') return '5h';
  if (windowKey === 'week') return '7d';
  return '＋';
}

function quotaActivityTemplate(windowKey, activityWindow) {
  if (!activityWindow) return '';
  const tone = cacheHitTone(activityWindow.cachedInputTokens, activityWindow.inputTokens);
  const titleKey = windowKey === 'fiveHour' ? 'windowUsage5h' : 'windowUsageWeek';
  return `
    <details class="quota-activity inline-details" data-detail="quota-${escapeHtml(windowKey)}">
      <summary title="${escapeHtml(T('quotaDetails'))}"><span>${escapeHtml(T('quotaDetails'))}</span></summary>
      <div class="disclosure-content">
      <div class="quota-activity-head">
        <span>${escapeHtml(T(titleKey))}</span>
        <b>${escapeHtml(T('totalShort', {
          v: formatTokenCount(activityWindow.tokens, { withUnit: false })
        }))}</b>
      </div>
      <small>
        <span>${escapeHtml(T('ioAmount', { v: formatTokenCount(activityWindow.ioTokens, { withUnit: false }) }))}</span>
        <em class="cache-hit-rate ${tone}">${escapeHtml(T('cacheHitShort', {
          v: formatCacheHitRate(activityWindow.cachedInputTokens, activityWindow.inputTokens)
        }))}</em>
      </small>
      </div>
    </details>
  `;
}

// ---- Motion ----

const quotaNumberMemory = new Map();
let quotaTweenToken = 0;

function animateQuotaNumbers() {
  const nodes = els.meters.querySelectorAll('strong[data-quota-key]');
  quotaTweenToken += 1;
  const token = quotaTweenToken;
  nodes.forEach((node) => {
    const key = node.dataset.quotaKey;
    const target = Number(node.dataset.quotaValue);
    const from = quotaNumberMemory.get(key);
    quotaNumberMemory.set(key, target);
    if (!Number.isFinite(from) || from === target || document.hidden || reduceMotion.matches) return;
    const startedAt = performance.now();
    const duration = 280;
    const step = (now) => {
      if (token !== quotaTweenToken || !node.isConnected) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = `${Math.round(from + (target - from) * eased)}%`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

let pendingRenderState = null;
let renderFrame = null;
let panelMotionAnimation = null;
let accentAnimations = [];
let rendererReadySent = false;

function requestRender(state) {
  pendingRenderState = state;
  if (renderFrame) return;
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = null;
    const nextState = pendingRenderState;
    pendingRenderState = null;
    if (!nextState) return;
    render(nextState);
    if (!rendererReadySent) {
      scheduleRendererReady();
    }
  });
}

function animatePanelMotion(motion) {
  if (!els.panel) return;
  panelMotionAnimation?.cancel();
  panelMotionAnimation = null;
  if (reduceMotion.matches) return;

  const closing = motion === 'closing';
  panelMotionAnimation = animateOne(els.panel, closing
    ? [
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
        { opacity: 0, transform: 'translate3d(0, -3px, 0)' }
      ]
    : [
        { opacity: 0, transform: 'translate3d(0, -4px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
      ], {
    duration: closing ? 120 : 200,
    easing: closing ? 'ease-in' : 'cubic-bezier(0.16, 1, 0.3, 1)',
    fill: closing ? 'forwards' : 'none'
  });
}

function playPanelOpeningSequence() {
  if (reduceMotion.matches || document.hidden) return;
  revealActivePanel();
}

function playProviderSwitchEffect(previousProvider, provider) {
  if (reduceMotion.matches || document.hidden) return;
  const activeOption = els.providerSwitch.querySelector('.provider-option.active');
  animateOne(activeOption, [
    { opacity: 0.65 },
    { opacity: 1 }
  ], { duration: 160, easing: 'ease-out' });
}

function playRefreshEffect() {
  if (reduceMotion.matches || document.hidden) return;
  animateOne(els.refresh, [{ opacity: 0.6 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
}

function playTabSwitchEffect() {
  if (reduceMotion.matches || document.hidden) return;
  const activeTab = els.tabs.find((tab) => tab.classList.contains('active'));
  animateOne(activeTab, [
    { opacity: 0.7 },
    { opacity: 1 }
  ], { duration: 160, easing: 'ease-out' });
}

function playAccentSweep({ strength = 1 } = {}) {
  if (reduceMotion.matches || document.hidden) return;
  accentAnimations.forEach((animation) => animation.cancel());
  accentAnimations = [];

  accentAnimations.push(animateOne(els.motionScan, [
    { opacity: 0, transform: 'translateX(0) skewX(-18deg)' },
    { opacity: strength, transform: 'translateX(150%) skewX(-18deg)', offset: 0.32 },
    { opacity: 0, transform: 'translateX(470%) skewX(-18deg)' }
  ], { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }));

  for (const [edge, direction] of [[els.motionEdgeTop, 'left'], [els.motionEdgeBottom, 'right']]) {
    if (!edge) continue;
    edge.style.transformOrigin = `${direction} center`;
    accentAnimations.push(animateOne(edge, [
      { opacity: 0, transform: 'scaleX(0)' },
      { opacity: strength, transform: 'scaleX(1)', offset: 0.45 },
      { opacity: 0, transform: 'scaleX(1)' }
    ], { duration: 720, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }));
  }

  accentAnimations.push(animateOne(els.aurora, [
    { opacity: 0.35, transform: 'scale(0.94)' },
    { opacity: 1, transform: 'scale(1.045)', offset: 0.52 },
    { opacity: 1, transform: 'scale(1)' }
  ], { duration: 760, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }));
  accentAnimations = accentAnimations.filter(Boolean);
}

function animatePanelDetails(activePanel, { celebrate = false } = {}) {
  const detailSelector = '.quota-card, .token-card, .trend-card, .iq-card, .quota-table, .reset-item, .empty';
  const details = [...activePanel.querySelectorAll(detailSelector)].slice(0, 8);
  details.forEach((element, index) => {
    const animation = animateOne(element, [
      { opacity: 0, transform: `translate3d(0, ${celebrate ? 10 : 7}px, 0) scale(0.965)` },
      { opacity: 1, transform: 'translate3d(0, -1px, 0) scale(1.008)', offset: 0.68 },
      { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
    ], {
      duration: celebrate ? 360 : 280,
      delay: 58 + index * (celebrate ? 34 : 24),
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'backwards'
    });
    if (animation) revealAnimations.push(animation);
  });

  [...activePanel.querySelectorAll('.quota-card strong')].slice(0, 2).forEach((number, index) => {
    const animation = animateOne(number, [
      { transform: 'scale(0.86)', opacity: 0.55 },
      { transform: 'scale(1.06)', opacity: 1, offset: 0.62 },
      { transform: 'scale(1)', opacity: 1 }
    ], {
      duration: 420,
      delay: 120 + index * 75,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'backwards'
    });
    if (animation) revealAnimations.push(animation);
  });

  [...activePanel.querySelectorAll('.quota-progress')].forEach((progress, index) => {
    const fill = progress.querySelector('i');
    const flare = progress.querySelector('.quota-flare');
    const fillAnimation = animateOne(fill, [
      { transform: 'scaleX(0)' },
      { transform: 'scaleX(1)' }
    ], {
      duration: 620,
      delay: 130 + index * 80,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards'
    });
    const flareAnimation = animateOne(flare, [
      { opacity: 0, transform: 'translateX(-140%) skewX(-18deg)' },
      { opacity: 1, offset: 0.24 },
      { opacity: 0, transform: 'translateX(580%) skewX(-18deg)' }
    ], { duration: 780, delay: 220 + index * 85, easing: 'ease-out' });
    if (fillAnimation) revealAnimations.push(fillAnimation);
    if (flareAnimation) revealAnimations.push(flareAnimation);
  });

  const heatmap = activePanel.querySelector('.token-heatmap');
  if (heatmap) {
    const animation = animateOne(heatmap, [
      { opacity: 0.2, transform: 'translate3d(0, 5px, 0) scale(0.985)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
    ], {
      duration: 360,
      delay: 150,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'backwards'
    });
    if (animation) revealAnimations.push(animation);
  }

  [...activePanel.querySelectorAll('.trend-five, .trend-week')].forEach((line, index) => {
    const animation = animateOne(line, [
      { strokeDasharray: 1, strokeDashoffset: 1, opacity: 0.25 },
      { strokeDasharray: 1, strokeDashoffset: 0, opacity: 1 }
    ], { duration: 820, delay: 220 + index * 110, easing: 'ease-out', fill: 'backwards' });
    if (animation) revealAnimations.push(animation);
  });
}

function emitEnergySparks(origin, count = 10) {
  if (!origin || !els.motionSparks || reduceMotion.matches || document.hidden) return;
  const originBounds = origin.getBoundingClientRect();
  const panelBounds = els.panel.getBoundingClientRect();
  const x = originBounds.left - panelBounds.left + originBounds.width / 2;
  const y = originBounds.top - panelBounds.top + originBounds.height / 2;

  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement('i');
    spark.className = 'energy-spark';
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.height = `${6 + (index % 4) * 2}px`;
    els.motionSparks.appendChild(spark);
    const angle = -172 + (360 / count) * index + (index % 2 ? 7 : -4);
    const distance = 24 + (index % 5) * 9;
    const animation = animateOne(spark, [
      { opacity: 0, transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(0) scaleY(0.25)` },
      { opacity: 1, offset: 0.18 },
      { opacity: 0, transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${distance}px) scaleY(1.35)` }
    ], {
      duration: 360 + (index % 3) * 70,
      delay: index * 12,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    });
    animation.finished.catch(() => {}).finally(() => spark.remove());
  }
}

function emitProviderTrail(previousProvider, provider) {
  if (!previousProvider || !provider || !els.motionSparks || reduceMotion.matches || document.hidden) return;
  const fromButton = els.providerSwitch.querySelector(`[data-provider="${previousProvider}"]`);
  const toButton = els.providerSwitch.querySelector(`[data-provider="${provider}"]`);
  if (!fromButton || !toButton || !fromButton.offsetParent || !toButton.offsetParent) return;
  const panelBounds = els.panel.getBoundingClientRect();
  const fromBounds = fromButton.getBoundingClientRect();
  const toBounds = toButton.getBoundingClientRect();
  const dx = toBounds.left - fromBounds.left;
  const dy = toBounds.top - fromBounds.top;

  for (let index = 0; index < 2; index += 1) {
    const echo = document.createElement('i');
    echo.className = 'provider-echo';
    echo.style.left = `${fromBounds.left - panelBounds.left}px`;
    echo.style.top = `${fromBounds.top - panelBounds.top}px`;
    echo.style.width = `${fromBounds.width}px`;
    echo.style.height = `${fromBounds.height}px`;
    els.motionSparks.appendChild(echo);
    const animation = animateOne(echo, [
      { opacity: 0, transform: 'translate3d(0, 0, 0) scale(0.86)' },
      { opacity: 0.28 - index * 0.07, offset: 0.18 },
      { opacity: 0.1, transform: `translate3d(${dx}px, ${dy}px, 0) scale(1.04)`, offset: 0.8 },
      { opacity: 0, transform: `translate3d(${dx}px, ${dy}px, 0) scale(1.1)` }
    ], {
      duration: 470,
      delay: index * 45,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    });
    animation.finished.catch(() => {}).finally(() => echo.remove());
  }
}

function playStatusComet() {
  if (!els.statusLine || reduceMotion.matches || document.hidden) return;
  const comet = document.createElement('i');
  comet.className = 'status-comet';
  els.statusLine.appendChild(comet);
  const animation = animateOne(comet, [
    { opacity: 0, transform: 'translateX(-130%) skewX(-18deg)' },
    { opacity: 1, offset: 0.22 },
    { opacity: 0, transform: 'translateX(720%) skewX(-18deg)' }
  ], { duration: 720, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  animation.finished.catch(() => {}).finally(() => comet.remove());
  window.setTimeout(() => comet.remove(), 900);
}

function animateOne(element, keyframes, options) {
  if (!element || reduceMotion.matches) return null;
  const scaledOptions = { ...options };
  if (Number.isFinite(Number(options?.duration))) {
    scaledOptions.duration = Math.round(Number(options.duration) * MOTION_TIME_SCALE);
  }
  if (Number.isFinite(Number(options?.delay))) {
    scaledOptions.delay = Math.round(Number(options.delay) * MOTION_TIME_SCALE);
  }
  return element.animate(keyframes, scaledOptions);
}

function unlimitedCardTemplate(label, activityWindow = null, activityWindowKey = null) {
  const windowMark = quotaWindowMark(activityWindowKey);
  return `
    <article class="quota-card quota-card-five-hour quota-card-unlimited" style="--quota-percent:100%;">
      <div class="quota-card-top">
        <span class="quota-window-title" title="${escapeHtml(T('remainingTitle', { label }))}">
          <i class="quota-window-mark" aria-hidden="true">${escapeHtml(windowMark)}</i>
          <span>${escapeHtml(T('remainingTitle', { label }))}</span>
        </span>
      </div>
      <strong class="quota-remaining-value">${escapeHtml(T('unlimitedBadge'))}</strong>
      <div class="quota-progress" aria-hidden="true">
        <i></i>
        <span class="quota-flare"></span>
      </div>
      <small>${escapeHtml(T('unlimitedFooter'))}</small>
      ${quotaActivityTemplate(activityWindowKey, activityWindow)}
    </article>
  `;
}

function isLocalActivitySource(source) {
  return source === 'claude_local' || source === 'codex_local';
}

function activityNotice(activity) {
  if (!activity) return '';
  if (activity.source === 'claude_local') return T('noticeLocal', { dir: '~/.claude' });
  if (activity.source === 'codex_local') return T('noticeLocal', { dir: '~/.codex' });
  return '';
}

function renderTokenActivity(tokenState) {
  const activity = tokenState.data;
  const localSuffix = isLocalActivitySource(activity?.source) ? T('localSuffix') : '';
  els.tokenUpdated.textContent = tokenState.fetchedAt
    ? `${T('updatedAt', { time: formatShortTime(tokenState.fetchedAt) })}${localSuffix}`
    : '';
  els.tokenUpdated.title = activityNotice(activity);
  if (!activity) {
    if (els.tokenRange) els.tokenRange.hidden = true;
    if (updateHtml(els.tokenActivity, emptyBlock(tokenState.error || T('noTokenData')))) hideChartTooltip();
    return;
  }
  if (activity.units !== 'tokens' || !isLocalActivitySource(activity.source)) {
    if (els.tokenRange) els.tokenRange.hidden = true;
    if (updateHtml(els.tokenActivity, emptyBlock(T('noTokenData')))) hideChartTooltip();
    return;
  }
  renderTokenRangeToggle();

  const heatmap = createTokenHeatmap(activity.days || []);
  const today = heatmap.today;
  // 7 天视图取热力图的最后 7 天（截至今天），上面的合计、明细里的费用和缓存命中都按这一段算。
  const weekView = tokenRange === 'week';
  const rangeDays = weekView ? heatmap.days.slice(-TOKEN_WEEK_DAYS) : heatmap.days;
  const windowDays = weekView ? TOKEN_WEEK_DAYS : Number(activity.windowDays) || 30;
  const totalIo = rangeDays.reduce((sum, day) => sum + Number(day.ioTokens || 0), 0);
  const totalTokens = rangeDays.reduce((sum, day) => sum + Number(day.tokens || 0), 0);
  const totalInput = rangeDays.reduce((sum, day) => sum + Number(day.inputTokens || 0), 0);
  const totalCachedInput = rangeDays.reduce((sum, day) => sum + Number(day.cachedInputTokens || 0), 0);
  const selectedDay = rangeDays.find((day) => day.day === activeTokenDay) || today;
  const statsHtml = `
    <div>
      <span>${escapeHtml(T('todayUsed'))}</span>
      <strong>${escapeHtml(formatTokenCount(today.tokens))}</strong>
    </div>
    <div>
      <span>${escapeHtml(T('windowUsed', { n: windowDays }))}</span>
      <strong>${escapeHtml(formatTokenCount(totalTokens))}</strong>
    </div>
  `;
  const detailText = `${formatMonthDay(selectedDay.day)} · ${formatTokenCount(selectedDay.tokens)}`;
  const detailSessions = T('sessionsCount', { n: Number(selectedDay.threads || 0) });
  const detailCache = T('cacheHitRate', {
    v: formatCacheHitRate(selectedDay.cachedInputTokens, selectedDay.inputTokens)
  });
  const totalCost = rangeDays.reduce((sum, day) => sum + Number(day.costUsd || 0), 0);
  const costLine = T('costLine', {
      today: formatCostUsd(today.costUsd),
      n: windowDays,
      total: formatCostUsd(totalCost)
    });
  const unpricedTokens = rangeDays.reduce((sum, day) => sum + Number(day.unpricedTokens || 0), 0);
  const unpricedModels = [...new Set(rangeDays.flatMap((day) => day.unpricedModels || []))];
  const unpricedLine = unpricedTokens > 0
    ? T('costUnpriced', {
        v: formatTokenCount(unpricedTokens),
        models: unpricedModels.slice(0, 2).map((model) => (model === '?' ? T('modelUnknown') : formatModelName(model))).join(' / ')
      })
    : '';

  // 30 天格子区在 7 天视图里也照样排出来、只是藏起来（不可见、不可点、读屏跳过），
  // 7 天图叠在同一格里、按它的高度排：切换时卡片和面板尺寸都不动。
  const heatmapHtml = `
      <div class="token-heatmap-wrap"${weekView ? ' inert aria-hidden="true"' : ''}>
        <div
          class="token-heatmap compact"
          style="--token-cols:${heatmap.columnCount}; --token-rows:${heatmap.rowCount}; --token-gap:${heatmap.gap}px;"
          aria-label="${escapeHtml(T('heatmapAria'))}"
        >
          ${heatmap.days.map((day) => `
            <span
              class="token-heatmap-cell${day.future ? ' future' : ''}${day.day === selectedDay.day ? ' selected' : ''}"
              tabindex="0"
              role="button"
              data-level="${day.level}"
              data-day="${escapeHtml(day.day)}"
              data-tokens="${escapeHtml(T('usedAmount', { v: formatTokenCount(day.tokens) }))}"
              data-cost="${escapeHtml(cellSecondaryText(day))}"
              data-cache="${escapeHtml(T('cacheHitRate', { v: formatCacheHitRate(day.cachedInputTokens, day.inputTokens) }))}"
              data-cache-tone="${cacheHitTone(day.cachedInputTokens, day.inputTokens)}"
              data-models="${escapeHtml(JSON.stringify(day.models || []))}"
              data-threads="${escapeHtml(cellMetaText(day))}"
              aria-label="${escapeHtml(`${day.day}${T('colonSep')}${T('usedAmount', { v: formatTokenCount(day.tokens) })}`)}"
              title="${escapeHtml(`${day.day}${T('colonSep')}${T('usedAmount', { v: formatTokenCount(day.tokens) })}`)}"
            >
              <span class="token-day-number">${escapeHtml(day.dayNumber)}</span>
            </span>
          `).join('')}
        </div>
        <div class="token-months compact" style="--token-cols:${heatmap.columnCount}; --token-gap:${heatmap.gap}px;">
          ${heatmap.months.map((month) => `
            <span style="grid-column:${month.column}">${escapeHtml(month.label)}</span>
          `).join('')}
        </div>
        <div class="token-heatmap-legend" aria-label="${escapeHtml(T('heatmapAria'))}">
          <span>${escapeHtml(T('heatmapLess'))}</span>
          <i class="heatmap-legend-swatch level-1"></i>
          <i class="heatmap-legend-swatch level-3"></i>
          <i class="heatmap-legend-swatch level-5"></i>
          <span>${escapeHtml(T('heatmapMore'))}</span>
        </div>
      </div>
  `;

  const markup = `
    <section class="token-card">
      <div class="token-stats">${statsHtml}</div>
      <div class="token-range-stage${weekView ? ' is-week' : ''}">
        ${heatmapHtml}
        ${weekView ? tokenWeekChartHtml(rangeDays, selectedDay) : ''}
      </div>
      <details class="inline-details token-more" data-detail="token-metrics">
        <summary title="${escapeHtml(T('activityDetails'))}">
          <span class="token-detail"><strong>${escapeHtml(detailText)}</strong></span>
        </summary>
        <div class="disclosure-content">
          <dl class="detail-metrics">
            ${detailMetric(T('todayUsed'), T('ioAmount', { v: formatTokenCount(today.ioTokens, { withUnit: false }) }))}
            ${detailMetric(T('windowUsed', { n: windowDays }), T('ioAmount', { v: formatTokenCount(totalIo, { withUnit: false }) }))}
            ${detailMetric(T('todayUsed'), T('cacheHitRate', { v: formatCacheHitRate(today.cachedInputTokens, today.inputTokens) }))}
            ${detailMetric(T('windowUsed', { n: windowDays }), T('cacheHitRate', { v: formatCacheHitRate(totalCachedInput, totalInput) }))}
            ${detailMetric(formatMonthDay(selectedDay.day), `${detailSessions} · ${detailCache}`)}
          </dl>
          ${projectBreakdownHtml(selectedDay)}
          <p class="detail-note">${escapeHtml(costLine)}</p>
          ${unpricedLine ? `<p class="detail-note">${escapeHtml(unpricedLine)}</p>` : ''}
          <p class="detail-note">${escapeHtml(T('costHint', { date: formatMonthDay(activity.pricingAsOf || '') }))}</p>
        </div>
      </details>
    </section>
  `;
  if (updateHtml(els.tokenActivity, markup)) {
    activeTokenBar = null;
    hideChartTooltip();
  }
}

function tokenWeekChartHtml(days, selectedDay) {
  const series = TOKEN_WEEK.weekSeries(days);
  const rows = days.map((day) => {
    const segments = TOKEN_WEEK.weekSegments(day, series);
    return { day, segments, total: segments.reduce((sum, segment) => sum + segment.value, 0) };
  });
  const heights = TOKEN_WEEK.barHeights(rows);
  const legend = [
    ...series.named.map((name, index) => ({ slot: index + 1, label: name === '?' ? T('modelUnknown') : formatModelName(name) })),
    ...(series.hasOther ? [{ slot: 'other', label: T('modelGroupOther') }] : [])
  ];
  return `
    <div class="token-week" role="group" aria-label="${escapeHtml(T('tokenWeekAria'))}">
      <div class="token-week-legend">
        ${legend.map((item) => `<span class="token-week-key" title="${escapeHtml(item.label)}"><i class="token-series-dot series-${item.slot}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></span>`).join('')}
      </div>
      <div class="token-week-plot" style="--token-week-cols:${rows.length}">
        ${rows.map(({ day, segments }, index) => {
          const height = heights[index];
          const models = (day.models || [])
            .map((model) => ({
              model: model?.model || '',
              value: tokenModelValue(model),
              slot: series.slots.get(String(model?.model || '')) || 'other'
            }))
            .filter((model) => model.model && model.value > 0);
          const selected = day.day === selectedDay.day;
          const label = `${day.day}${T('colonSep')}${T('usedAmount', { v: formatTokenCount(day.tokens) })}`;
          return `
          <span
            class="token-week-col${selected ? ' selected' : ''}"
            tabindex="0"
            role="button"
            aria-pressed="${selected}"
            data-day="${escapeHtml(day.day)}"
            data-tokens="${escapeHtml(T('usedAmount', { v: formatTokenCount(day.tokens) }))}"
            data-cost="${escapeHtml(cellSecondaryText(day))}"
            data-cache="${escapeHtml(T('cacheHitRate', { v: formatCacheHitRate(day.cachedInputTokens, day.inputTokens) }))}"
            data-cache-tone="${cacheHitTone(day.cachedInputTokens, day.inputTokens)}"
            data-models="${escapeHtml(JSON.stringify(models))}"
            data-threads="${escapeHtml(cellMetaText(day))}"
            aria-label="${escapeHtml(label)}"
          >
            <span class="token-week-track"><span class="token-week-bar" style="height:${height.toFixed(1)}%">${segments.map((segment) => `<i class="token-week-seg series-${segment.slot}" style="flex-grow:${segment.value}"></i>`).join('')}</span></span>
            <span class="token-week-day">${escapeHtml(formatMonthDay(day.day))}</span>
          </span>`;
        }).join('')}
      </div>
    </div>
  `;
}

// 单日详情里的项目拆分：横条长度是当天 token 占比，数值和费用写在右侧（文字不用序列色）。
function projectBreakdownHtml(day) {
  const rows = Array.isArray(day?.projects) ? day.projects.filter((row) => Number(row.tokens) > 0) : [];
  if (!rows.length) return '';
  const max = Math.max(1, ...rows.map((row) => Number(row.tokens) || 0));
  return `
    <div class="project-breakdown">
      <p class="project-title">${escapeHtml(T('projectsTitle', { day: formatMonthDay(day.day) }))}</p>
      <ul>
        ${rows.map((row) => {
          const label = row.name
            || (row.other ? T('projectsOther', { n: row.other }) : T('projectUnknown'));
          const width = Math.max(2, (Number(row.tokens) / max) * 100).toFixed(1);
          const value = `${formatTokenCount(row.tokens, { withUnit: false })} · ${formatCostUsd(row.costUsd)}`;
          return `
            <li title="${escapeHtml(`${label}${T('colonSep')}${T('sessionsCount', { n: Number(row.sessions || 0) })}`)}">
              <span class="project-name">${escapeHtml(label)}</span>
              <span class="project-bar"><i style="width:${width}%"></i></span>
              <span class="project-value">${escapeHtml(value)}</span>
            </li>`;
        }).join('')}
      </ul>
    </div>
  `;
}

const HEATMAP_ROWS = 3;
const HEATMAP_COLS = 10;
const HEATMAP_DAYS = HEATMAP_ROWS * HEATMAP_COLS;
const HEATMAP_GAP = 6;

function createTokenHeatmap(rawDays) {
  const todayDate = startOfDay(new Date());
  const startDate = startOfDay(todayDate);
  startDate.setDate(startDate.getDate() - (HEATMAP_DAYS - 1));

  const dayMap = new Map((rawDays || []).map((day) => [day.day, day]));
  const days = [];
  const months = [];
  let today = null;

  for (let index = 0; index < HEATMAP_DAYS; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dayKey = formatIsoDate(date);
    const source = dayMap.get(dayKey) || {};
    const future = date > todayDate;
    const value = Number(source.value ?? source.tokens ?? 0);
    const tokens = Number(source.tokens ?? source.value ?? 0);
    const hasCacheMetrics = source.inputTokens !== null
      && source.inputTokens !== undefined
      && source.cachedInputTokens !== null
      && source.cachedInputTokens !== undefined
      && Number.isFinite(Number(source.inputTokens))
      && Number.isFinite(Number(source.cachedInputTokens));

    if (index === 0 || index === HEATMAP_DAYS - 1) {
      months.push({ column: (index % HEATMAP_COLS) + 1, label: formatMonthDay(dayKey) });
    }

    const item = {
      day: dayKey,
      dayNumber: date.getDate(),
      threads: Number(source.threads || 0),
      value: future ? 0 : value,
      tokens: future ? 0 : tokens,
      ioTokens: future ? 0 : Number(source.ioTokens || 0),
      inputTokens: future || !hasCacheMetrics ? null : Math.max(0, Number(source.inputTokens)),
      cachedInputTokens: future || !hasCacheMetrics ? null : Math.max(0, Number(source.cachedInputTokens)),
      costUsd: future ? 0 : Number(source.costUsd || 0),
      unpricedTokens: future ? 0 : Number(source.unpricedTokens || 0),
      unpricedModels: Array.isArray(source.unpricedModels) ? source.unpricedModels : [],
      models: Array.isArray(source.models) ? source.models : [],
      projects: future || !Array.isArray(source.projects) ? [] : source.projects,
      future
    };
    if (isSameDay(date, todayDate)) today = item;
    days.push(item);
  }

  // 深浅只和窗口内可见天数比较，窗口外的历史峰值不该压平整张热力图。
  const maxValue = Math.max(1, ...days.map((day) => (day.future ? 0 : Number(day.value) || 0)));
  for (const day of days) {
    day.level = day.future ? 0 : tokenHeatLevel(day.value, maxValue);
  }

  return {
    days,
    months,
    today: today || {
      day: formatIsoDate(todayDate),
      threads: 0,
      value: 0,
      tokens: 0,
      ioTokens: 0,
      inputTokens: null,
      cachedInputTokens: null,
      costUsd: 0,
      unpricedTokens: 0,
      unpricedModels: [],
      models: [],
      projects: [],
      level: 0
    },
    columnCount: HEATMAP_COLS,
    rowCount: HEATMAP_ROWS,
    gap: HEATMAP_GAP
  };
}

function tokenHeatLevel(tokens, maxTokens) {
  const value = Number(tokens || 0);
  if (value <= 0) return 0;
  const ratio = value / Math.max(1, Number(maxTokens || 1));
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.55) return 4;
  if (ratio >= 0.32) return 3;
  if (ratio >= 0.14) return 2;
  return 1;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderResetCards(state, provider) {
  if (els.resetTitle) els.resetTitle.textContent = T(provider === 'claude' ? 'resetTitleClaude' : 'resetTitleCodex');
  if (els.openRadar) els.openRadar.textContent = T(provider === 'claude' ? 'openOfficialUsage' : 'openSource');
  const usageState = activeSlices(state).usage || {};
  // 重置卡在最上面；下面是各额度窗口自动重置的时间，两块都来自官方接口。
  const blocks = [
    resetCreditsTemplate(usageState.data?.resetCredits, provider),
    resetScheduleTemplate(usageState, provider),
    provider === 'claude' ? claudeNotesTemplate(state.claudeRadar?.data) : ''
  ];
  els.resetCards.innerHTML = blocks.filter(Boolean).join('');
}

// 各额度窗口什么时候重置。数据来自官方用量接口，和雷达站无关，雷达连不上时照常显示。
function resetScheduleTemplate(usageState, provider) {
  const usage = usageState.data;
  if (!usage) return emptyBlock(usageState.error || T('noUsageData'));

  const rows = [];
  if (usage.fiveHourUnlimited) rows.push({ title: T('label5h'), unlimited: true });
  else if (usage.primaryWindow) rows.push({ title: T('label5h'), window: usage.primaryWindow, tone: 'five' });
  // 只有存在专项周限额（例如 Fable）时，才需要把总的周限额标成「全部模型」来区分。
  const weekTitle = usage.extraWindows?.length ? T('resetWindowWeekAll') : T('labelWeek');
  if (usage.secondaryWindow) rows.push({ title: weekTitle, window: usage.secondaryWindow, tone: 'week' });
  (usage.extraWindows || []).forEach((windowValue) => {
    rows.push({ title: scopedWindowLabel(windowValue), window: windowValue, tone: 'week' });
  });
  if (!rows.length) return emptyBlock(T('windowUnavailable'));

  const source = provider === 'claude' ? T('resetSourceClaude') : T('resetSourceCodex');
  const updated = usageState.fetchedAt ? ` · ${T('updatedAt', { time: formatShortTime(usageState.fetchedAt) })}` : '';
  return `
    <div class="reset-timeline reset-schedule" aria-label="${escapeHtml(T('resetScheduleTitle'))}">
      ${rows.map((row) => resetScheduleRowTemplate(row)).join('')}
    </div>
    <p class="reset-footnote">${escapeHtml(`${source}${updated}`)}</p>
  `;
}

function resetScheduleRowTemplate({ title, window: windowValue, unlimited = false, tone = 'five' }) {
  if (unlimited) {
    return `
      <article class="reset-row unlimited" style="--reset-percent:100;">
        <span class="reset-ring" aria-hidden="true"></span>
        <div class="reset-row-main"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(T('unlimitedFooter'))}</small></div>
        <div class="reset-row-side"><strong>${escapeHtml(T('unlimitedBadge'))}</strong></div>
      </article>
    `;
  }
  const remaining = clamp(Math.round(Number(windowValue.remainingPercent) || 0), 0, 100);
  const used = clamp(Math.round(Number(windowValue.usedPercent) || 0), 0, 100);
  const critical = !windowValue.inactive && remaining <= 10;
  const when = windowValue.resetAt ? formatResetMoment(windowValue.resetAt) : T(windowValue.inactive ? 'notStarted' : 'noneShort');
  const countdown = windowValue.resetAt
    ? formatReset(windowValue.resetAt)
    : T(windowValue.inactive ? 'inactiveFooter' : 'noResetFooter');
  return `
    <article class="reset-row ${escapeHtml(tone)}${critical ? ' critical' : ''}" style="--reset-percent:${remaining};">
      <span class="reset-ring" aria-hidden="true"></span>
      <div class="reset-row-main">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(T('resetUsageLine', { left: remaining, used }))}</small>
      </div>
      <div class="reset-row-side">
        <strong>${escapeHtml(when)}</strong>
        <small>${escapeHtml(countdown)}</small>
      </div>
    </article>
  `;
}

// 重置时刻：今天/明天只写时间，更远的日期带上星期，一眼能看出是哪天。
function formatResetMoment(value) {
  // 接口给的时刻带零点几秒的偏差（同一次重置会是 11:59:59.89 和 12:00:00.89），先取整到分钟。
  const date = new Date(Math.round(Number(new Date(value)) / 60_000) * 60_000);
  if (Number.isNaN(date.getTime())) return '--';
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  if (isSameDay(date, today)) return T('todayAt', { time });
  if (isSameDay(date, tomorrow)) return T('tomorrowAt', { time });
  const day = new Intl.DateTimeFormat(lang, { month: 'numeric', day: 'numeric' }).format(date);
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(date);
  return `${day} ${weekday} ${time}`;
}

// 重置卡：账号持有的、可以主动兑换的额度重置。Codex 来自重置卡接口，
// Claude 来自官方用量接口的可用重置（官方客户端里的 /limit-reset），两边共用这一块。
function resetCreditsTemplate(credits, provider) {
  if (!credits) return '';
  const items = credits.credits || [];
  const withheld = !items.length && credits.unavailableReason && credits.unavailableReason !== 'no_grant';
  let body = '';
  if (credits.error) {
    body = `<p class="reset-timeline-note">${escapeHtml(credits.error)}</p>`;
  } else if (items.length) {
    body = `<div class="reset-timeline-list">
      ${items.map((credit) => resetTimelineItemTemplate(
        credit.title || resetKindLabel(credit.kind, provider),
        statusLabel(credit.status),
        resetCreditDetail(credit),
        resetStatusClass(credit.status)
      )).join('')}
    </div>`;
  } else if (withheld) {
    body = `<p class="reset-timeline-note">${escapeHtml(resetWithheldText(credits.unavailableReason))}</p>`;
  }
  const summary = credits.error || withheld
    ? T('resetCardsWithheld')
    : T('creditsAvailable', { n: credits.availableCount ?? items.length });
  return `
    <div class="reset-timeline reset-credits">
      <div class="reset-timeline-summary">
        <span>${escapeHtml(T('resetCardsTitle'))}</span>
        <strong>${escapeHtml(summary)}</strong>
      </div>
      ${body}
    </div>
  `;
}

function resetKindLabel(kind, provider) {
  const keys = { session: 'resetKindSession', weekly: 'resetKindWeekly', full: 'resetKindFull' };
  if (keys[kind]) return T(keys[kind]);
  return provider === 'claude' ? T('resetKindGeneric') : 'Codex reset';
}

function resetCreditDetail(credit) {
  const parts = [];
  if (Number.isFinite(credit.resetsLeft) && Number(credit.resetsTotal) > 0) {
    parts.push(T('resetsLeftLine', { left: credit.resetsLeft, total: credit.resetsTotal }));
  }
  parts.push(credit.expiresAt ? T('expiresAt', { t: formatDateTime(credit.expiresAt) }) : T('noExpiry'));
  return parts.join(' · ');
}

// 接口明确表示这次不给出重置卡时的说明。surface：按客户端类型限制，本应用不在名单里。
function resetWithheldText(reason) {
  if (reason === 'surface') return T('resetReasonSurface');
  return T('resetReasonOther', { reason });
}

// Claude 雷达站提供的额度校准说明；雷达站没有数据时整块不显示。
function claudeNotesTemplate(radar) {
  if (!radar) return '';
  const quota = radar.quota || {};
  const calibratedAt = formatRadarUpdateLabel(quota.updatedAt, radar.updatedAt);
  return `
    <div class="reset-timeline">
      <div class="reset-timeline-summary">
        <span>${escapeHtml(T('resetTimelineTitle'))}</span>
        <strong>${escapeHtml(calibratedAt || '--')}</strong>
      </div>
      <div class="reset-timeline-list">
        ${resetTimelineItemTemplate(
          T('calibTitle'),
          T('calibStatus'),
          quota.chartLabel || quota.note || T('calibNone'),
          'available'
        )}
        ${resetTimelineItemTemplate(
          T('srcTitle'),
          T('sourceStatus'),
          T('attributionClaude'),
          'neutral'
        )}
      </div>
    </div>
  `;
}

function resetTimelineItemTemplate(title, status, detail, tone = 'neutral') {
  return `
    <article class="reset-item ${escapeHtml(tone)}">
      <span class="reset-marker" aria-hidden="true"></span>
      <div class="reset-item-body">
        <div class="reset-item-head">
          <strong>${escapeHtml(title)}</strong>
          <span class="reset-status ${escapeHtml(tone)}">${escapeHtml(status)}</span>
        </div>
        <p>${escapeHtml(detail)}</p>
      </div>
    </article>
  `;
}

function resetStatusClass(status) {
  if (['available', 'redeemed', 'expired'].includes(status)) return status;
  if (status === 'pending') return 'info';
  if (status === 'paused' || status === 'unavailable') return 'watch';
  return 'neutral';
}

function renderIq(radarState, provider) {
  const radar = radarState?.data;
  els.modelCatalogNotice.hidden = true;
  els.radarDataNotice.hidden = true;
  els.radarBriefStatus.hidden = true;
  // 没有任何雷达数据时，推荐模型卡和排序按钮都是空壳，收起来只留一句说明。
  els.radarPanel?.classList.toggle('radar-no-data', !radar);
  if (!radar) {
    if (els.iqDate) els.iqDate.textContent = '';
    renderRadarSummary([], provider);
    const paused = radarState?.errorCode === RADAR_PAUSED_CODE;
    updateHtml(els.iqGrid, paused
      ? `<div class="empty radar-paused"><strong>${escapeHtml(T('radarPaused'))}</strong><p>${escapeHtml(T('radarPausedHint'))}</p>${serviceComponentsTemplate(currentState ? activeSlices(currentState).service : null)}</div>`
      : emptyBlock(radarState?.error || T('noIqData')));
    if (els.expandModels) els.expandModels.hidden = true;
    return;
  }

  const updatedLabel = provider === 'claude'
    ? formatRadarUpdateLabel(radar.iqUpdatedAt, radar.updatedAt)
    : formatRadarUpdateLabel(
        radar.modelIq.updatedAt,
        radar.monitoredAt,
        radar.modelIq.latestDate,
        radar.quotaRadar.updatedAt
      );
  // 四题分榜只有读取时间，和顶栏的「已更新」重复，就不在标题旁再写一遍。
  if (els.iqDate) els.iqDate.textContent = updatedLabel && radar.modelIq?.timestampBasis !== 'read'
    ? T('lastUpdated', { t: updatedLabel }) : '';
  renderIqCards(provider === 'claude' ? radar.items || [] : radar.modelIq.items || [], provider);
  const updatedAt = provider === 'claude' ? radar.iqUpdatedAt || radar.updatedAt
    : radar.modelIq.updatedAt || radar.modelIq.latestDate;
  const timestamp = Date.parse(updatedAt);
  const notices = [];
  const fourMode = isCodexFourMode(radar.modelIq);
  if (radar.modelIq?.scoreMode === 'radar-bench-v2-150') {
    notices.push(T('radarBenchNotice'));
    if (radar.modelIq.partial) notices.push(T('radarPartialRead', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }));
  } else if (fourMode) {
    notices.push(T('radarFourNotice', { date: formatRadarRoundDate(radar.modelIq.roundTestedAt) }));
    if (radar.modelIq.partial) notices.push(T('radarFourPartial', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }));
  }
  if (radarState.error) notices.push(radarState.error);
  if (Number.isFinite(timestamp) && Date.now() - timestamp > 72 * 3600_000) {
    notices.push(T('radarSourceStale', { date: new Intl.DateTimeFormat(lang, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp) }));
  }
  const items = provider === 'claude' ? radar.items || [] : radar.modelIq.items || [];
  if (radarLatestByProvider[provider] && !items.some((item) => item.isLatest && item.isCurrentGeneration && radarScore(item) !== null)) {
    notices.push(T('radarLatestPending'));
  }
  els.radarDataNotice.textContent = notices.join(' ');
  els.radarDataNotice.hidden = !notices.length;
  els.radarDataNotice.classList.toggle('info', (radar.modelIq?.scoreMode === 'radar-bench-v2-150' || fourMode) && !radarState.error);
  const stale = Number.isFinite(timestamp) && Date.now() - timestamp > 72 * 3600_000;
  const partial = radar.modelIq?.partial;
  els.radarBriefStatus.hidden = !radarState.error && !stale && !partial;
  els.radarBriefStatus.textContent = radarState.error || stale ? T('radarAttention')
    : partial ? T(fourMode ? 'radarFourPartialShort' : 'radarPartialShort', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }) : '';
}

// 四题众测分榜（scoreMode 形如 codex-four-weighted-150-v2）。
function isCodexFourMode(modelIq) {
  return typeof modelIq?.scoreMode === 'string' && modelIq.scoreMode.startsWith('codex-four');
}

function formatRadarRoundDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat(lang, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp)
    : '--';
}

// 雷达停更时用官方状态页补位：逐个列出相关组件的状态，颜色只在小圆点上，文字说明状态。
function serviceComponentsTemplate(slice) {
  const data = slice?.data;
  if (!data?.components?.length) return '';
  const rows = data.components.map((component) => {
    const level = SERVICE_LEVEL_TONE[component.level] ? component.level : 'none';
    return `<li class="service-row"><span class="status-item ${SERVICE_LEVEL_TONE[level]}"><i aria-hidden="true"></i>${escapeHtml(component.name)}</span><b>${escapeHtml(T(`serviceLevel_${level}`))}</b></li>`;
  }).join('');
  const incidents = (data.incidents || []).map((incident) => `<li class="service-incident">${escapeHtml(incident.name)}</li>`).join('');
  const home = typeof data.home === 'string' && data.home.startsWith('https://') ? data.home : '';
  return `
    <div class="service-status-card">
      <div class="service-status-head">
        <span>${escapeHtml(T('serviceStatusTitle'))}</span>
        ${slice.fetchedAt ? `<small>${escapeHtml(T('updatedAt', { time: formatShortTime(slice.fetchedAt) }))}</small>` : ''}
      </div>
      <ul>${rows}${incidents}</ul>
      ${home ? `<button type="button" class="text-button" data-open-url="${escapeHtml(home)}">${escapeHtml(T('serviceStatusOpen'))}</button>` : ''}
    </div>
  `;
}

els.iqGrid?.addEventListener('click', (event) => {
  const link = event.target.closest('[data-open-url]');
  if (!link || !els.iqGrid.contains(link)) return;
  event.preventDefault();
  window.codexMeter.openExternal(link.dataset.openUrl);
});

function renderIqCards(allItems, provider = currentProviderKey()) {
  const latestOnly = Boolean(radarLatestByProvider[provider]);
  const items = latestOnly ? allItems.filter((item) => item.isLatest && item.isCurrentGeneration) : allItems;
  if (provider === 'codex') {
    const names = [...new Set(allItems.filter((item) => item.isLatest && item.isCurrentGeneration).map((item) => item.modelLabel))]
      .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
    els.modelCatalogNotice.hidden = names.length === 0;
    els.modelCatalogNames.textContent = T('latestModels', { models: names.join(' / ') });
    els.latestModelsFilter.textContent = T(latestOnly ? 'allModels' : 'onlyLatestModels');
    els.latestModelsFilter.setAttribute('aria-pressed', String(latestOnly));
  }
  if (!items.length) {
    renderRadarSummary([], provider);
    updateHtml(els.iqGrid, emptyBlock(T('noIqData')));
    if (els.expandModels) els.expandModels.hidden = true;
    return;
  }

  const sort = radarSortByProvider[provider] || 'iq';
  const sortedItems = sortRadarItems(items, sort);
  const expanded = Boolean(radarExpandedByProvider[provider]);
  const visibleSet = new Set(expanded ? sortedItems : sortedItems.slice(0, 6));
  const groups = groupRadarItems(sortedItems, visibleSet, expanded);

  renderRadarSummary(allItems.filter((item) => !item.catalogOnly), provider);
  if (els.iqSortButtons) {
    els.iqSortButtons.forEach((button) => {
      const active = button.dataset.iqSort === sort;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      const labelKeys = { iq: 'iqSortIq', value: 'iqSortValue', speed: 'iqSortSpeed' };
      button.textContent = `${T(labelKeys[button.dataset.iqSort])}${active ? sortDirectionMark(sort) : ''}`;
    });
  }
  if (els.iqGrid) {
    updateHtml(els.iqGrid, groups.map((group) => `
      <section class="model-group ${escapeHtml(group.key)}">
        <div class="model-group-head">
          <div>
            <span class="model-group-dot" aria-hidden="true"></span>
            <strong>${escapeHtml(group.label)}</strong>
          </div>
          <span>${group.total}</span>
        </div>
        <div class="iq-compare-table">
          ${group.items.map((item) => radarModelCardTemplate(item)).join('')}
        </div>
      </section>
    `).join(''));
  }

  if (els.expandModels) {
    const hiddenCount = Math.max(0, sortedItems.length - 6);
    els.expandModels.hidden = hiddenCount === 0;
    els.expandModels.textContent = expanded
      ? T('collapseModels')
      : T('expandModels', { n: hiddenCount });
    els.expandModels.setAttribute('aria-expanded', String(expanded));
  }
}

// 按原站显示精度（两位小数）比较 IQ：四题分榜常有多档并列满分，浮点误差不该拆开它们。
function radarScoreKey(item) {
  const score = radarScore(item);
  return score === null ? null : Math.round(score * 100) / 100;
}

function sortRadarItems(items, sort) {
  return items.slice().sort((left, right) => {
    if (sort === 'value') {
      const valueOrder = compareRadarNumbers(radarValueScore(left), radarValueScore(right));
      if (valueOrder !== 0) return valueOrder;
    } else if (sort === 'speed') {
      const speedOrder = compareRadarNumbers(radarAverageSeconds(left), radarAverageSeconds(right), { ascending: true });
      if (speedOrder !== 0) return speedOrder;
    }

    const iqOrder = compareRadarNumbers(radarScoreKey(left), radarScoreKey(right));
    if (iqOrder !== 0) return iqOrder;
    // 同分时便宜的在前，推荐模型也就落在同分里最省钱的那一档。
    const costOrder = compareRadarNumbers(radarAverageCost(left), radarAverageCost(right), { ascending: true });
    if (costOrder !== 0) return costOrder;
    return String(left.modelLabel || left.label || '').localeCompare(String(right.modelLabel || right.label || ''), 'en', { sensitivity: 'base' });
  });
}

function compareRadarNumbers(left, right, { ascending = false } = {}) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftValid = left !== null && left !== undefined && left !== '' && Number.isFinite(leftNumber);
  const rightValid = right !== null && right !== undefined && right !== '' && Number.isFinite(rightNumber);
  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return ascending ? leftNumber - rightNumber : rightNumber - leftNumber;
}

function radarScore(item) {
  if (item?.score === null || item?.score === undefined || item?.score === '') return null;
  const score = Number(item?.score);
  return Number.isFinite(score) ? score : null;
}

function radarAverageCost(item) {
  const value = Number(item?.averageCostUsd ?? item?.avgCostUsd);
  if (Number.isFinite(value) && value > 0) return value;
  const total = Number(item?.costUsd);
  const tasks = Number(item?.tasks);
  return Number.isFinite(total) && total > 0 && Number.isFinite(tasks) && tasks > 0
    ? total / tasks
    : null;
}

function radarAverageSeconds(item) {
  const seconds = Number(item?.averageTaskSeconds ?? item?.avgTaskSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  const hours = Number(item?.wallHours);
  return Number.isFinite(hours) && hours > 0 ? hours * 3600 : null;
}

function radarValueScore(item) {
  const score = radarScore(item);
  const cost = radarAverageCost(item);
  return score !== null && cost !== null ? score / cost : null;
}

function groupRadarItems(items, visibleSet, expanded) {
  const order = [
    ['astra', T('modelGroupAstra')],
    ['sol', T('modelGroupSol')],
    ['terra', T('modelGroupTerra')],
    ['luna', T('modelGroupLuna')],
    ['other', T('modelGroupOther')]
  ];
  const grouped = new Map(order.map(([key, label]) => [key, { key, label, total: 0, items: [] }]));
  items.forEach((item) => {
    const key = radarModelGroup(item);
    const group = grouped.get(key) || grouped.get('other');
    group.total += 1;
    if (expanded || visibleSet.has(item)) group.items.push(item);
  });
  return order
    .map(([key]) => grouped.get(key))
    .filter((group) => group.items.length);
}

function radarModelGroup(item) {
  const label = `${item?.modelLabel || ''} ${item?.label || ''}`.toLowerCase();
  if (label.includes('sol')) return 'sol';
  if (label.includes('terra')) return 'terra';
  if (label.includes('luna')) return 'luna';
  if (label.includes('astra')) return 'astra';
  return 'other';
}

function radarModelCardTemplate(item) {
  const score = radarScore(item);
  const reasoning = String(item.reasoningEffort || '').trim();
  const modelName = item.modelLabel || item.label || 'Model';
  const status = item.status || 'unknown';
  const scoreText = score === null ? T('metricPending') : score.toFixed(1);
  const reasoningText = reasoning ? reasoning.toUpperCase() : T('metricPending');
  return `
    <details class="model-detail inline-details ${escapeHtml(status)}" data-detail="model:${escapeHtml(`${item.modelId || modelName}:${reasoning}`)}">
      <summary class="model-summary">
        <span class="model-identity"><strong>${escapeHtml(modelName)}</strong><small>${escapeHtml(reasoningText)}</small></span>
        <span class="model-score"><small>IQ</small><strong${score === null ? ' class="pending"' : ''}>${escapeHtml(scoreText)}</strong></span>
      </summary>
      <div class="disclosure-content">
        <dl class="detail-metrics">
          ${detailMetric(T('iqMetricCost'), radarMetricText(formatAverageCost(item)))}
          ${detailMetric(T('iqMetricTime'), radarMetricText(formatAverageTime(item)))}
          ${radarTaskMetrics(item)}
        </dl>
        ${item.costBasis === 'official_standard_api_equivalent' ? `<p class="detail-note">${escapeHtml(T('radarCostEvidence', { n: item.costKnownSamples ?? '-', total: item.costTotalSamples ?? '-' }))}</p>` : ''}
      </div>
    </details>
  `;
}

const RADAR_TASK_LABELS = {
  combined: 'iqTaskCombined',
  pompeii: 'iqTaskPompeii',
  pelican: 'iqTaskPelican',
  candy: 'iqTaskCandy'
};

// 四题众测：详情里换成每题的加权得分（如 秦始皇 40.8/60），不认识的题目不显示；
// 其他数据源仍显示题次和测评覆盖。
function radarTaskMetrics(item) {
  const tasks = Array.isArray(item?.taskScores)
    ? item.taskScores.filter((task) => RADAR_TASK_LABELS[task?.key])
    : [];
  if (!tasks.length) {
    return `${detailMetric(T(item.sampleBasis === 'graded' ? 'iqColumnGradedSamples' : 'iqColumnSamples'), radarMetricText(formatSampleCount(item)))}
          ${detailMetric(T('metricCoverage'), formatPassedRatio(item))}`;
  }
  return tasks.map((task) => detailMetric(T(RADAR_TASK_LABELS[task.key]), formatTaskPoints(task))).join('');
}

function trimDecimal(value) {
  return String(Number(Number(value).toFixed(1)));
}

function formatTaskPoints(task) {
  const points = Number(task?.points);
  const max = Number(task?.max);
  if (task?.points === null || task?.points === undefined || !Number.isFinite(points)) return T('metricPending');
  return Number.isFinite(max) && max > 0 ? `${trimDecimal(points)}/${trimDecimal(max)}` : trimDecimal(points);
}

function formatPassedRatio(item) {
  if (item?.sampleBasis === 'graded' && item.coverage !== null && item.benchmarkTasks !== null) {
    return T('radarCoverage', { n: item.coverage, total: item.benchmarkTasks });
  }
  if (item?.passed === null || item?.passed === undefined || item?.passed === ''
    || item?.tasks === null || item?.tasks === undefined || item?.tasks === '') {
    return T('metricPending');
  }
  const passed = Number(item?.passed);
  const tasks = Number(item?.tasks);
  return Number.isFinite(passed) && Number.isFinite(tasks)
    ? T('passedRatio', { p: Math.round(passed), t: Math.round(tasks) })
    : T('metricPending');
}

function radarMetricText(value) {
  return value === '-' || value === '--' ? T('metricPending') : value;
}

function renderRadarSummary(items, provider) {
  const recommended = sortRadarItems(items, 'iq')[0];
  if (els.recommendedModel) els.recommendedModel.textContent = recommended
    ? recommended.modelLabel || recommended.label || 'Model'
    : '--';
  if (els.recommendedMeta) els.recommendedMeta.textContent = recommended
    ? T('recommendedMeta', {
        score: formatRadarScore(recommended),
        reasoning: recommended.reasoningEffort ? recommended.reasoningEffort.toUpperCase() : '-'
      })
    : T('recommendedWaiting');

  const signal = radarDegradationSignal(items);
  if (els.iqDegradeAlert) {
    // 没有任何档位带历史分数时只会一直显示「样本积累中」，整行收起。
    els.iqDegradeAlert.hidden = signal.level === 'neutral';
    els.iqDegradeAlert.classList.toggle('warning', signal.level === 'warning');
    els.iqDegradeAlert.classList.toggle('watch', signal.level === 'watch');
  }
  if (els.iqDegradeValue) els.iqDegradeValue.textContent = signal.message;
  void provider;
}

function formatRadarScore(item) {
  const score = radarScore(item);
  return score === null ? '--' : score.toFixed(1);
}

function formatAverageCost(item) {
  const cost = radarAverageCost(item);
  return cost === null ? '-' : `$${cost.toFixed(item?.costBasis === 'official_standard_api_equivalent' ? 2 : cost >= 10 ? 1 : 2)}`;
}

function formatAverageTime(item) {
  const human = String(item?.averageTaskTimeHuman || '').trim();
  if (human) return localizeRadarDuration(human);
  const seconds = radarAverageSeconds(item);
  if (seconds === null) return '-';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}${T('secondsShort')}`;
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}${T('minutesShort')}`;
  return `${(seconds / 3600).toFixed(seconds >= 36_000 ? 0 : 1)}${T('hoursShort')}`;
}

function localizeRadarDuration(value) {
  const text = String(value || '').trim();
  const zhMatch = text.match(/^([\d.]+)\s*(秒|分钟|小时|分|时)$/);
  if (!zhMatch) return text;
  const amount = zhMatch[1];
  if (zhMatch[2] === '秒') return `${amount}${T('secondsShort')}`;
  if (zhMatch[2] === '分钟' || zhMatch[2] === '分') return `${amount}${T('minutesShort')}`;
  return `${amount}${T('hoursShort')}`;
}

function formatSampleCount(item) {
  const value = item?.sampleBasis === 'graded' ? item.sampleCount : item?.sampleCount24h;
  if (value === null || value === undefined || value === '') return '-';
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? String(Math.round(count)) : '-';
}

function radarDegradationSignal(items) {
  const changes = items.map((item) => {
    const series = Array.isArray(item?.recentScores)
      ? item.recentScores.filter((sample) => sample?.score !== null
          && sample?.score !== undefined
          && sample?.score !== ''
          && Number.isFinite(Number(sample.score)))
      : [];
    if (series.length < 2) return null;
    const first = Number(series[0].score);
    const last = Number(series[series.length - 1].score);
    if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
    return { item, delta: last - first };
  }).filter(Boolean);

  if (!changes.length) return { level: 'neutral', message: T('degradationMonitoring') };
  const worst = changes.reduce((current, next) => next.delta < current.delta ? next : current);
  const drop = Math.abs(worst.delta);
  if (worst.delta <= -5) {
    return {
      level: 'warning',
      message: T('degradationWarning', { model: worst.item.modelLabel || worst.item.label || 'Model', delta: drop.toFixed(1) })
    };
  }
  if (worst.delta <= -2) {
    return {
      level: 'watch',
      message: T('degradationWatch', { model: worst.item.modelLabel || worst.item.label || 'Model', delta: drop.toFixed(1) })
    };
  }
  return { level: 'stable', message: T('degradationStable') };
}

function iqWallTime(item) {
  const human = String(item.wallTimeHuman || '').trim();
  if (human) {
    // codexradar 的 wall_time_human 是中文（如“46分钟”），非中文界面下转成本地化写法。
    const zhMatch = human.match(/^([\d.]+)\s*(分钟|小时)$/);
    if (!zhMatch) return human;
    return zhMatch[2] === '分钟'
      ? T('wallMinutes', { m: zhMatch[1] })
      : T('wallHours', { h: zhMatch[1] });
  }
  const hours = Number(item.wallHours);
  if (!Number.isFinite(hours)) return '-';
  if (hours < 1) return T('wallMinutes', { m: Math.max(1, Math.round(hours * 60)) });
  return T('wallHours', { h: hours.toFixed(hours >= 10 ? 0 : 1) });
}

function radarItemsForProvider(radar, provider) {
  if (!radar) return [];
  return provider === 'claude' ? radar.items || [] : radar.modelIq?.items || [];
}

function renderModelUsage(radar, provider, activityState) {
  if (!els.modelUsageRows) return;
  const radarItems = radarItemsForProvider(radar, provider);
  const activityUsage = aggregateActivityModelUsage(activityState);
  const rows = activityUsage.rows.map((row) => ({
        ...row,
        radarItem: findRadarItemForModel(row.model, radarItems)
      }));

  if (!rows.length) {
    if (els.modelUsageSummary) els.modelUsageSummary.innerHTML = '';
    els.modelUsageRows.innerHTML = emptyBlock(activityState?.error || T('modelUsageNoActivity'));
    return;
  }

  const groupedRows = groupModelUsageRows(rows);
  const totalText = activityUsage.totalTokens > 0
    ? T('modelUsageTotal', { v: formatTokenCount(activityUsage.totalTokens) })
    : T('modelUsageNoActivity');
  const costText = activityUsage.totalCost > 0
    ? T('modelUsageEstimatedTotal', { v: formatCostUsd(activityUsage.totalCost) })
    : '';
  if (els.modelUsageSummary) {
    els.modelUsageSummary.innerHTML = `
      <span>${escapeHtml(totalText)}</span>
      ${costText ? `<strong>${escapeHtml(costText)}</strong>` : ''}
    `;
  }

  els.modelUsageRows.innerHTML = `
    <div class="model-usage-row model-usage-head">
      <span>${escapeHtml(T('modelUsageModel'))}</span>
      <span>${escapeHtml(T('modelUsageTokens'))}</span>
      <span>${escapeHtml(T('modelUsageShare'))}</span>
      <span>${escapeHtml(T('modelUsageEstimate'))}</span>
    </div>
    ${groupedRows.map(({ row, group }) => {
      const item = row.radarItem;
      const shareKnown = row.share !== null && row.share !== undefined && Number.isFinite(Number(row.share));
      const shareText = shareKnown ? formatModelShare(row.share) : T('metricPending');
      const shareBar = shareKnown
        ? `<span class="model-usage-share" aria-hidden="true"><i style="--share:${clamp(Number(row.share) * 100, 0, 100)}%"></i></span>`
        : '';
      return `
        <div class="model-usage-row">
          <span class="model-usage-model">
            <i class="model-usage-dot ${escapeHtml(group.key)}" aria-hidden="true"></i>
            <strong>${escapeHtml(formatModelName(row.model))}</strong>
          </span>
          <strong>${escapeHtml(row.tokens === null ? T('metricPending') : formatTokenCount(row.tokens))}</strong>
          <span class="model-usage-share-cell" title="${escapeHtml(shareText)}">
            ${shareBar}
            <b>${escapeHtml(shareText)}</b>
          </span>
          <strong>${escapeHtml(row.estimatedCost === null ? T('metricPending') : formatCostUsd(row.estimatedCost))}</strong>
        </div>
      `;
    }).join('')}
  `;
}

function formatModelBenchmark(item) {
  if (!item) return T('modelUsageUnavailable');
  const parts = [];
  const cost = formatAverageCost(item);
  const time = formatAverageTime(item);
  const samples = formatSampleCount(item);
  if (cost !== '-') parts.push(T('modelUsageAvgCost', { v: cost }));
  if (time !== '-') parts.push(time);
  if (samples !== '-') parts.push(T('modelUsageSampleCount', { n: samples }));
  return parts.length ? parts.join(' · ') : T('modelUsageUnavailable');
}

function aggregateActivityModelUsage(activityState) {
  const days = Array.isArray(activityState?.data?.days)
    ? activityState.data.days.filter((day) => !day.future && Array.isArray(day.models) && day.models.length)
    : [];
  if (!days.length) return { rows: [], totalTokens: 0, totalCost: 0, day: null };

  const latestDay = days.map((day) => String(day.day || '')).sort().at(-1);
  const selectedDays = days.filter((day) => day.day === latestDay);
  const modelMap = new Map();
  selectedDays.forEach((day) => {
    day.models.forEach((model) => {
      const key = String(model?.model || '').trim();
      if (!key) return;
      const previous = modelMap.get(key) || 0;
      modelMap.set(key, previous + tokenModelValue(model));
    });
  });
  const totalTokens = [...modelMap.values()].reduce((sum, value) => sum + value, 0);
  const totalCost = selectedDays.reduce((sum, day) => sum + Math.max(0, Number(day.costUsd) || 0), 0);
  const rows = [...modelMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([model, tokens]) => ({
      model,
      tokens,
      share: totalTokens > 0 ? tokens / totalTokens : null,
      estimatedCost: totalCost > 0 && totalTokens > 0 ? totalCost * tokens / totalTokens : null
    }));
  return { rows, totalTokens, totalCost, day: latestDay };
}

function findRadarItemForModel(model, items) {
  const key = normalizeModelKey(model);
  if (!key) return null;
  return items.find((item) => {
    const candidates = [item?.modelLabel, item?.label]
      .filter(Boolean)
      .map(normalizeModelKey);
    return candidates.some((candidate) => candidate.includes(key) || key.includes(candidate));
  }) || null;
}

function normalizeModelKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function groupModelUsageRows(rows) {
  const order = ['astra', 'sol', 'terra', 'luna', 'other'];
  const groups = new Map(order.map((key) => [key, { key, rows: [] }]));
  rows.forEach((row) => {
    const key = radarModelGroup(row.radarItem || { modelLabel: row.model });
    groups.get(key).rows.push(row);
  });
  return order.flatMap((key) => groups.get(key).rows.map((row) => ({ row, group: groups.get(key) })));
}

function formatModelShare(value) {
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(Number(value) * 100)}%`;
}

function renderQuota(radarState, provider, activityState) {
  const radar = radarState.data;
  if (els.quotaSource) els.quotaSource.textContent = provider === 'claude' ? 'Claude Code Radar' : 'Codex Radar';
  renderModelUsage(radar, provider, activityState);
  if (!radar) {
    els.quotaRows.innerHTML = emptyBlock(radarState.errorCode === RADAR_PAUSED_CODE
      ? T('radarPaused')
      : radarState.error || T('noQuotaRadar'));
    return;
  }

  if (provider === 'claude') {
    renderClaudeQuota(radar);
    return;
  }

  const rows = radar.quotaRadar.rows || [];
  if (!rows.length) {
    els.quotaRows.innerHTML = emptyBlock(T('noQuotaRadar'));
    return;
  }

  els.quotaRows.innerHTML = `
    <div class="quota-row quota-head">
      <span>${escapeHtml(T('colTier'))}</span>
      <span>5h</span>
      <span>7d</span>
    </div>
    ${rows.map((row) => `
      <div class="quota-row">
        <span>${escapeHtml(row.tier || '-')}</span>
        <strong>${formatMoney(row.five_h)}</strong>
        <strong>${formatMoney(row.seven_d)}</strong>
      </div>
    `).join('')}
  `;
}

function renderClaudeQuota(radar) {
  const quota = radar.quota || {};
  const usageByKey = {};
  (quota.usage || []).forEach((row) => {
    if (row.key) usageByKey[row.key] = row;
  });
  const hasQuota = Number.isFinite(quota.baseH5) || Number.isFinite(quota.baseD7) || (quota.usage || []).length;
  if (!hasQuota) {
    els.quotaRows.innerHTML = emptyBlock(T('noQuotaRadar'));
    return;
  }

  const rows = [
    [T('rowMeasured'), formatMoney(quota.baseH5), formatMoney(quota.baseD7)],
    [T('rowSharedUsed'), formatQuotaPercent(usageByKey.h5), formatQuotaPercent(usageByKey.d7)],
    [T('rowReset'), formatQuotaReset(usageByKey.h5), formatQuotaReset(usageByKey.d7)]
  ];

  els.quotaRows.innerHTML = `
    <div class="quota-row quota-head">
      <span>${escapeHtml(T('colMetric'))}</span>
      <span>5h</span>
      <span>7d</span>
    </div>
    ${rows.map(([label, five, seven]) => `
      <div class="quota-row">
        <span>${escapeHtml(label)}</span>
        <strong>${five}</strong>
        <strong>${seven}</strong>
      </div>
    `).join('')}
  `;
}

function formatQuotaPercent(row) {
  return Number.isFinite(row?.usedPercent) ? `${row.usedPercent}%` : '-';
}

function formatQuotaReset(row) {
  const text = String(row?.resetText || '').replace(/\s*重置\s*$/, '').trim();
  return text ? escapeHtml(text) : '-';
}

function emptyBlock(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

let tooltipBar = null;
let tooltipFrame = null;
let tooltipPointer = null;
let tooltipSize = null;

function showChartTooltip(bar, event) {
  if (!els.chartTooltip || !bar?.isConnected) return;
  if (tooltipBar !== bar) {
    tooltipBar = bar;
    els.chartTooltip.innerHTML = `
    <strong>${escapeHtml(bar.dataset.day || '-')}</strong>
    <span>${escapeHtml(bar.dataset.tokens || '-')}</span>
    ${bar.dataset.cost ? `<span>${escapeHtml(bar.dataset.cost)}</span>` : ''}
    ${bar.dataset.cache ? `<span class="cache-hit-rate ${escapeHtml(bar.dataset.cacheTone || 'cache-hit-neutral')}">${escapeHtml(bar.dataset.cache)}</span>` : ''}
    ${tokenModelTooltip(bar.dataset.models)}
    <span>${escapeHtml(bar.dataset.threads || T('sessionsCount', { n: 0 }))}</span>
    `;
    els.chartTooltip.classList.add('visible');
    tooltipSize = els.chartTooltip.getBoundingClientRect();
  }
  tooltipPointer = { x: event.clientX, y: event.clientY };
  if (tooltipFrame) return;
  tooltipFrame = window.requestAnimationFrame(() => {
    tooltipFrame = null;
    if (!tooltipBar?.isConnected || !tooltipPointer || !tooltipSize) return;
    const margin = 10;
    const x = Math.max(margin, Math.min(window.innerWidth - tooltipSize.width - margin, tooltipPointer.x + 12));
    const y = Math.max(margin, Math.min(window.innerHeight - tooltipSize.height - margin, tooltipPointer.y - tooltipSize.height - 12));
    els.chartTooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  });
}

function tokenModelTooltip(serializedModels) {
  let models = [];
  try {
    const parsed = JSON.parse(serializedModels || '[]');
    models = Array.isArray(parsed) ? parsed : [];
  } catch {
    models = [];
  }
  if (!models.length) return '';

  const sortedModels = models.slice().sort((left, right) => tokenModelValue(right) - tokenModelValue(left));
  const total = sortedModels.reduce((sum, model) => sum + tokenModelValue(model), 0);
  const rows = sortedModels.map((model, index) => {
    const value = tokenModelValue(model);
    const share = total > 0 ? `${((value / total) * 100).toFixed(value / total >= 0.1 ? 0 : 1)}%` : '-';
    return `
      <span class="chart-tooltip-model-row">
        <i class="chart-tooltip-model-dot ${model?.slot !== undefined ? `series-${escapeHtml(String(model.slot))}` : `tone-${index % 5}`}" aria-hidden="true"></i>
        <em>${escapeHtml(formatModelName(model?.model || '-'))}</em>
        <small>${escapeHtml(share)}</small>
        <b>${escapeHtml(formatTokenCount(value))}</b>
      </span>
    `;
  }).join('');

  return `
    <div class="chart-tooltip-models">
      <strong>${escapeHtml(T('modelsUsed'))}</strong>
      ${rows}
    </div>
  `;
}

function tokenModelValue(model) {
  return Math.max(0, Number(model?.value ?? model?.tokens ?? model?.weighted ?? 0) || 0);
}

// 曲线的十字线提示：内容随指针位置变化，每次都重算尺寸再定位。
function showTrendTooltip(markup, event) {
  if (!els.chartTooltip) return;
  tooltipBar = null;
  if (els.chartTooltip.innerHTML !== markup) els.chartTooltip.innerHTML = markup;
  els.chartTooltip.classList.add('visible', 'trend-tooltip');
  const size = els.chartTooltip.getBoundingClientRect();
  const margin = 10;
  const x = clamp(event.clientX + 12, margin, window.innerWidth - size.width - margin);
  const y = clamp(event.clientY - size.height - 12, margin, window.innerHeight - size.height - margin);
  els.chartTooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

function hideChartTooltip() {
  if (!els.chartTooltip) return;
  if (tooltipFrame) window.cancelAnimationFrame(tooltipFrame);
  tooltipFrame = null;
  tooltipBar = null;
  tooltipPointer = null;
  tooltipSize = null;
  els.chartTooltip.classList.remove('visible', 'trend-tooltip');
}

function statusLabel(status) {
  const keys = {
    available: 'statusAvailable',
    redeemed: 'statusRedeemed',
    expired: 'statusExpired',
    pending: 'statusPending',
    paused: 'statusPaused',
    unavailable: 'statusUnavailable'
  };
  return keys[status] ? T(keys[status]) : status || T('statusUnknown');
}

function formatClock(value) {
  if (!value) return '--:--';
  return new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function formatShortTime(value) {
  if (!value) return '--:--';
  return new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(lang, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function formatRadarUpdateLabel(...values) {
  for (const value of values) {
    const label = formatRadarDateValue(value);
    if (label) return label;
  }
  return '';
}

function formatRadarDateValue(value) {
  if (!value) return '';
  const text = String(value);
  const radarDate = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:-(am|pm)(?:_\d+)?)?$/i);
  if (radarDate) {
    const [, , month, day, halfDay] = radarDate;
    const suffix = halfDay?.toLowerCase() === 'am' ? T('amSuffix') : halfDay?.toLowerCase() === 'pm' ? T('pmSuffix') : '';
    return `${month}/${day}${suffix}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return formatDateTime(date);
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `$${number.toFixed(number >= 100 ? 0 : 1)}`;
}

function formatCostUsd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '$0';
  if (number >= 100) return `$${Math.round(number)}`;
  if (number >= 10) return `$${number.toFixed(1)}`;
  return `$${number.toFixed(2)}`;
}

function cacheHitPercent(cachedInputTokens, inputTokens) {
  const cached = Number(cachedInputTokens);
  const input = Number(inputTokens);
  if (!Number.isFinite(cached) || !Number.isFinite(input) || input <= 0) return null;
  return clamp((cached / input) * 100, 0, 100);
}

function formatCacheHitRate(cachedInputTokens, inputTokens) {
  const rate = cacheHitPercent(cachedInputTokens, inputTokens);
  if (rate === null) return '--';
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(rate)}%`;
}

function cacheHitTone(cachedInputTokens, inputTokens) {
  const rate = cacheHitPercent(cachedInputTokens, inputTokens);
  if (rate === null) return 'cache-hit-neutral';
  // 按显示出来的那个数字（保留 1 位小数）判色，否则 98.97% 会显示成 99% 却是黄色。
  const shown = Math.round(rate * 10) / 10;
  if (shown >= 99) return 'cache-hit-good';
  if (shown >= 95) return 'cache-hit-warning';
  return 'cache-hit-critical';
}

function cellSecondaryText(day) {
  return Number(day.ioTokens || 0) > 0 ? T('ioAmount', { v: formatTokenCount(day.ioTokens) }) : '';
}

function cellMetaText(day) {
  const sessions = T('sessionsCount', { n: Number(day.threads || 0) });
  const models = Array.isArray(day.models) && day.models.length > 0
    ? day.models.slice(0, 2).map((model) => formatModelName(model.model)).join(' / ')
    : '';
  return models ? `${sessions} · ${models}` : sessions;
}

// gpt-6.2-sol → GPT-6.2 Sol、claude-opus-5-5 → Opus 5.5，和雷达页的型号写法一致（规则在 token-week.js）。
function formatModelName(value) {
  return TOKEN_WEEK.formatModelName(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatReset(value) {
  if (!value) return T('noResetFooter');
  const diffMs = Number(value) - Date.now();
  // 过了 resetAt 而接口还没返回新窗口：明确说「已重置」，不再一直显示「即将重置」。
  if (diffMs <= 0) return T('resetPassed');
  const totalMinutes = Math.max(0, Math.round(diffMs / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  // 具体的重置时刻已经显示在卡片右上角，这里只给相对时间，避免重复和换行。
  if (days > 0) return hours > 0 ? T('resetInDH', { d: days, h: hours }) : T('resetInD', { d: days });
  if (hours > 0 && minutes > 0) return T('resetInHM', { h: hours, m: minutes });
  if (hours > 0) return T('resetInH', { h: hours });
  if (minutes > 0) return T('resetInM', { m: minutes });
  return T('resetSoon');
}

function formatResetClock(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  const time = new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
  const today = new Date();
  if (isSameDay(date, today)) return time;
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(date, tomorrow)) return T('tomorrowAt', { time });
  const day = new Intl.DateTimeFormat(lang, {
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  return `${day} ${time}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatMonthDay(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(lang, {
    month: 'numeric',
    day: 'numeric'
  }).format(date);
}

function formatTokenCount(value, options) {
  return I18N.formatTokenCount(lang, value, options);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
