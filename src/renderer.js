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
    return { usage: state.claudeUsage || {}, radar: state.claudeRadar || {}, activity: state.claudeActivity || {} };
  }
  if (EXTRA_PROVIDER_IDS.includes(provider)) {
    return { usage: state[`${provider}Usage`] || {}, radar: { status: 'idle' }, activity: { status: 'idle' } };
  }
  return { usage: state.usage, radar: state.radar, activity: state.tokenActivity };
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
  const fallback = provider === 'claude' ? 'https://claudecoderadar.com/' : 'https://codexradar.com/';
  const url = (currentState ? activeSlices(currentState).radar?.data?.sourceUrl : null) || fallback;
  window.codexMeter.openExternal(url);
});

els.tokenActivity.addEventListener('mouseover', (event) => {
  const cell = event.target.closest('.token-heatmap-cell');
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
  const nextCell = nextTarget?.closest?.('.token-heatmap-cell');
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
  const cell = event.target.closest('.token-heatmap-cell');
  if (!cell || !els.tokenActivity.contains(cell)) return;
  selectTokenDay(cell);
});

els.tokenActivity.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const cell = event.target.closest('.token-heatmap-cell');
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

els.panel.addEventListener('wheel', handlePanelWheel, { passive: true });

window.codexMeter.onState(requestRender);
window.codexMeter.onPanelMotion((motion) => {
  animatePanelMotion(motion);
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
  const chrome = [els.toolbar, els.statusLine].reduce((sum, node) => {
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
    setActiveRadarView('intelligence', {
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
    renderSection('reset', [slices.usage, slices.radar], () => renderResetCards(stateValue, provider));
    return;
  }
  renderSection('iq', [slices.radar, radarSortByProvider[provider], radarExpandedByProvider[provider], radarLatestByProvider[provider]], () => renderIq(slices.radar, provider));
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
    renderSection('trend', [slices.usage, stateValue.usageHistory?.[provider], clockBucket], () => renderTrend(stateValue, slices.usage, provider));
    if (!isExtra) renderSection('tokens', [slices.activity, activeTokenDay, formatIsoDate(new Date())], () => renderTokenActivity(slices.activity));
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

// ---- 额度曲线 + 燃烧率预测 ----

const TREND_W = 372;
const TREND_H = 92;
const TREND_PLOT = Object.freeze({ left: 34, right: 7, top: 11, bottom: 19 });

function renderTrend(state, usageState, provider) {
  if (!els.usageTrend) return;
  const history = (state.usageHistory && state.usageHistory[provider]) || [];
  const now = Date.now();
  const start = now - 24 * 3600_000;
  const visible = history.filter((sample) => (
    Number.isFinite(Number(sample?.t))
    && Number(sample.t) >= start
    && Number(sample.t) <= now + 60_000
  ));
  const usage = usageState.data;
  const fiveSampleCount = visible.filter((sample) => Number.isFinite(sample.five)).length;
  const weekSampleCount = visible.filter((sample) => Number.isFinite(sample.week)).length;
  const hasFive = !usage?.fiveHourUnlimited && fiveSampleCount > 0;
  const hasWeek = weekSampleCount > 0;
  const fiveCurveReady = hasFive && fiveSampleCount >= 3;
  const weekCurveReady = hasWeek && weekSampleCount >= 3;

  const burnFive = hasFive ? computeBurn(visible, 'five', 90 * 60_000) : null;
  const burnWeek = hasWeek ? computeBurn(visible, 'week', 12 * 3600_000) : null;
  const lines = [
    burnText(T('windowName5h'), burnFive, usage?.primaryWindow?.resetAt),
    burnText(T('windowNameWeek'), burnWeek, usage?.secondaryWindow?.resetAt)
  ].filter(Boolean);
  if (!hasFive) {
    lines.unshift(T(usage?.fiveHourUnlimited ? 'trendUnlimited' : 'trendUnavailable', {
      window: T('windowName5h')
    }));
  }
  if (!hasWeek) lines.push(T('trendUnavailable', { window: T('windowNameWeek') }));

  const fiveStatus = usage?.fiveHourUnlimited
    ? T('trendUnlimited', { window: T('windowName5h') })
    : fiveCurveReady
      ? T('windowName5h')
      : hasFive
        ? T('trendSamplePending', { window: T('windowName5h'), n: Math.min(3, fiveSampleCount) })
        : T('trendUnavailable', { window: T('windowName5h') });
  const weekStatus = weekCurveReady
    ? T('windowNameWeek')
    : hasWeek
      ? T('trendSamplePending', { window: T('windowNameWeek'), n: Math.min(3, weekSampleCount) })
      : T('trendUnavailable', { window: T('windowNameWeek') });
  if (els.trendLegend) {
    els.trendLegend.innerHTML = `
      <span class="trend-legend-item${usage?.fiveHourUnlimited ? ' unlimited' : hasFive ? (fiveCurveReady ? '' : ' sampling') : ' unavailable'}" title="${escapeHtml(fiveStatus)}">
        <span class="trend-dot trend-dot-five"></span>${escapeHtml(T('windowName5h'))}${usage?.fiveHourUnlimited ? ' ∞' : ''}
      </span>
      <span class="trend-legend-item${hasWeek ? (weekCurveReady ? '' : ' sampling') : ' unavailable'}" title="${escapeHtml(weekStatus)}">
        <span class="trend-dot trend-dot-week"></span>${escapeHtml(T('windowNameWeek'))}
      </span>
    `;
  }
  const weekPath = weekCurveReady ? trendPath(visible, 'week', 'trend-week', now) : '';
  const fivePath = fiveCurveReady ? trendPath(visible, 'five', 'trend-five', now) : '';
  const noCurve = !weekPath && !fivePath;
  const pendingSamples = [
    !usage?.fiveHourUnlimited && !fiveCurveReady
      ? T('trendSamplePending', { window: T('windowName5h'), n: Math.min(3, fiveSampleCount) })
      : null,
    !weekCurveReady
      ? T('trendSamplePending', { window: T('windowNameWeek'), n: Math.min(3, weekSampleCount) })
      : null
  ].filter(Boolean);
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
      <svg viewBox="0 0 ${TREND_W} ${TREND_H}" role="img" aria-label="${escapeHtml(T('trendChartAria'))}">
        ${trendAxes()}
        ${weekPath}
        ${fivePath}
      </svg>
    `;
  updateHtml(els.usageTrend, `
    <section class="trend-card${noCurve ? ' trend-card-empty' : ''}">
      ${trendVisual}
      <div class="trend-lines">
        ${lines.map((line) => `<span class="trend-line">${escapeHtml(line)}</span>`).join('')}
      </div>
    </section>
  `);
}

function trendY(usedPercent) {
  const usable = TREND_H - TREND_PLOT.top - TREND_PLOT.bottom;
  return TREND_PLOT.top + usable - (clamp(usedPercent, 0, 100) / 100) * usable;
}

function trendX(timestamp, now) {
  const start = now - 24 * 3600_000;
  const usable = TREND_W - TREND_PLOT.left - TREND_PLOT.right;
  return TREND_PLOT.left + clamp((timestamp - start) / (24 * 3600_000), 0, 1) * usable;
}

function trendPlotCenterX() {
  return TREND_PLOT.left + (TREND_W - TREND_PLOT.left - TREND_PLOT.right) / 2;
}

function trendAxes() {
  const plotRight = TREND_W - TREND_PLOT.right;
  const plotBottom = TREND_H - TREND_PLOT.bottom;
  const yTicks = [100, 50, 0].map((value) => {
    const y = trendY(value);
    return `
      <line class="trend-grid" x1="${TREND_PLOT.left}" y1="${y}" x2="${plotRight}" y2="${y}" />
      <text class="trend-axis-label trend-axis-y" x="${TREND_PLOT.left - 5}" y="${y + 3}" text-anchor="end">${value}</text>
    `;
  }).join('');
  const xTicks = [
    { ratio: 0, label: T('trendX24h'), anchor: 'start' },
    { ratio: 0.5, label: T('trendX12h'), anchor: 'middle' },
    { ratio: 1, label: T('trendXNow'), anchor: 'end' }
  ].map(({ ratio, label, anchor }) => {
    const x = TREND_PLOT.left + ratio * (plotRight - TREND_PLOT.left);
    return `
      <line class="trend-axis-tick" x1="${x}" y1="${plotBottom}" x2="${x}" y2="${plotBottom + 3}" />
      <text class="trend-axis-label trend-axis-x" x="${x}" y="${TREND_H - 4}" text-anchor="${anchor}">${escapeHtml(label)}</text>
    `;
  }).join('');
  return `
    <text class="trend-axis-title" x="${TREND_PLOT.left}" y="8">${escapeHtml(T('trendYAxis'))}</text>
    ${yTicks}
    <line class="trend-axis" x1="${TREND_PLOT.left}" y1="${TREND_PLOT.top}" x2="${TREND_PLOT.left}" y2="${plotBottom}" />
    <line class="trend-axis" x1="${TREND_PLOT.left}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" />
    ${xTicks}
  `;
}

function trendPath(samples, key, className, now = Date.now()) {
  const points = samples
    .filter((s) => Number.isFinite(s[key]))
    .map((s) => {
      const x = trendX(s.t, now);
      return `${x.toFixed(1)},${trendY(s[key]).toFixed(1)}`;
    });
  if (points.length < 2) return '';
  return `<polyline class="${className}" pathLength="1" points="${points.join(' ')}" />`;
}

function computeBurn(history, key, windowMs) {
  const samples = history.filter((s) => Number.isFinite(s[key]));
  if (samples.length < 3) return null;
  // 只用最近一次重置之后的样本（用量大幅回落视为重置）。
  let startIndex = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index][key] < samples[index - 1][key] - 25) startIndex = index;
  }
  const now = Date.now();
  const segment = samples.slice(startIndex).filter((s) => s.t >= now - windowMs);
  if (segment.length < 3) return null;
  const first = segment[0];
  const last = segment[segment.length - 1];
  const minutes = (last.t - first.t) / 60_000;
  if (minutes < 10) return null;
  return {
    ratePerHour: ((last[key] - first[key]) / minutes) * 60,
    current: last[key]
  };
}

function burnText(windowLabel, burn, resetAt) {
  if (!burn) return null;
  if (burn.ratePerHour <= 0.5) return T('burnFlat', { window: windowLabel });
  const rate = burn.ratePerHour >= 10 ? Math.round(burn.ratePerHour) : burn.ratePerHour.toFixed(1);
  const etaMs = ((100 - burn.current) / burn.ratePerHour) * 3600_000;
  const etaAt = Date.now() + etaMs;
  if (resetAt && etaAt >= resetAt) return T('burnSafe', { window: windowLabel, rate });
  return T('burnRising', { window: windowLabel, rate, time: formatResetClock(etaAt) });
}

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
  if (els.openRadar) els.openRadar.textContent = T('openSource');
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
  if (radar.status === 'error') statusParts.push(statusPart(radar.error || T('statusRadarFailed'), 'danger'));
  const errors = [usage, radar, token].filter((slice) => slice.status === 'error').length;
  const loading = [usage, radar, token].some((slice) => ['loading', 'refreshing'].includes(slice.status));
  const fetchedAt = [usage, radar, token].map((slice) => slice.fetchedAt).filter(Boolean).sort().at(-1);
  const brief = errors ? T('statusCompactError', { n: errors })
    : loading ? T('statusCompactLoading')
      : fetchedAt ? T('statusCompactOk', { time: formatClock(fetchedAt) }) : T('statusWaiting');
  updateHtml(els.statusLine, `<details class="inline-details sync-details" data-detail="sync-status">
    <summary>${statusPart(brief, errors ? 'danger' : loading ? 'loading' : 'good')}</summary>
    <div class="disclosure-content">${statusParts.join('') || statusPart(T('statusWaiting'), 'neutral')}</div>
  </details>`);
}

function statusPart(text, tone) {
  return `<span class="status-item ${tone}"><i aria-hidden="true"></i>${escapeHtml(text)}</span>`;
}

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
  els.usageUpdated.textContent = usageState.fetchedAt
    ? `${T('updatedAt', { time: formatShortTime(usageState.fetchedAt) })}${officialSuffix}`
    : '';
  els.usageUpdated.title = provider === 'claude' && usage ? T('officialTip') : '';
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
      activityWindowKey: 'week'
    }));
  }
  (usage.extraWindows || []).forEach((windowValue) => {
    const label = isExtra
      ? String(windowValue.name || '').trim() || T('labelWeek')
      : `${T('labelWeek')} ${windowValue.name || ''}`.trim();
    cards.push(quotaCardTemplate(windowValue, label, { provider }));
  });
  if (updateHtml(els.meters, cards.length ? cards.join('') : emptyBlock(T('windowUnavailable')))) animateQuotaNumbers();
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
  activityWindowKey = null
} = {}) {
  if (!windowValue) return emptyBlock(T('windowUnavailable'));
  const remaining = Number.isFinite(Number(windowValue.remainingPercent))
    ? clamp(Math.round(Number(windowValue.remainingPercent)), 0, 100)
    : 0;
  const inactive = provider === 'claude' && windowValue.inactive;
  const critical = !inactive && remaining <= 10;
  const footer = windowValue.resetAt
    ? formatReset(windowValue.resetAt)
    : inactive
      ? T('inactiveFooter')
      : T('noResetFooter');
  const windowClass = quotaWindowClass(activityWindowKey);
  const windowMark = quotaWindowMark(activityWindowKey);
  const windowTitle = T('remainingTitle', { label });
  return `
    <article class="quota-card ${windowClass}${critical ? ' critical' : ''}" style="--quota-percent:${remaining}%;">
      <div class="quota-card-top">
        <span class="quota-window-title" title="${escapeHtml(T('remainingTitle', { label }))}">
          <i class="quota-window-mark" aria-hidden="true">${escapeHtml(windowMark)}</i>
          <span>${escapeHtml(windowTitle)}</span>
        </span>
      </div>
      <strong class="quota-remaining-value" data-quota-key="${escapeHtml(`${provider}:${label}`)}" data-quota-value="${remaining}">${remaining}%</strong>
      <div class="quota-progress" aria-hidden="true">
        <i></i>
        <span class="quota-flare"></span>
      </div>
      <small>${escapeHtml(footer)}</small>
      ${quotaActivityTemplate(activityWindowKey, activityWindow)}
    </article>
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
      <summary>${escapeHtml(T('quotaDetails'))}</summary>
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
    if (updateHtml(els.tokenActivity, emptyBlock(tokenState.error || T('noTokenData')))) hideChartTooltip();
    return;
  }
  if (activity.units !== 'tokens' || !isLocalActivitySource(activity.source)) {
    if (updateHtml(els.tokenActivity, emptyBlock(T('noTokenData')))) hideChartTooltip();
    return;
  }

  const heatmap = createTokenHeatmap(activity.days || []);
  const today = heatmap.today;
  const windowDays = Number(activity.windowDays) || 30;
  const totalIo = heatmap.days.reduce((sum, day) => sum + Number(day.ioTokens || 0), 0);
  const totalTokens = heatmap.days.reduce((sum, day) => sum + Number(day.tokens || 0), 0);
  const totalInput = heatmap.days.reduce((sum, day) => sum + Number(day.inputTokens || 0), 0);
  const totalCachedInput = heatmap.days.reduce((sum, day) => sum + Number(day.cachedInputTokens || 0), 0);
  const selectedDay = heatmap.days.find((day) => day.day === activeTokenDay) || today;
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
  const totalCost = heatmap.days.reduce((sum, day) => sum + Number(day.costUsd || 0), 0);
  const costLine = T('costLine', {
      today: formatCostUsd(today.costUsd),
      n: windowDays,
      total: formatCostUsd(totalCost)
    });

  const markup = `
    <section class="token-card">
      <div class="token-stats">${statsHtml}</div>
      <div class="token-heatmap-wrap">
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
      <div class="token-detail">
        <strong>${escapeHtml(detailText)}</strong>
      </div>
      <details class="inline-details" data-detail="token-metrics">
        <summary>${escapeHtml(T('activityDetails'))}</summary>
        <div class="disclosure-content">
          <dl class="detail-metrics">
            ${detailMetric(T('todayUsed'), T('ioAmount', { v: formatTokenCount(today.ioTokens, { withUnit: false }) }))}
            ${detailMetric(T('windowUsed', { n: windowDays }), T('ioAmount', { v: formatTokenCount(totalIo, { withUnit: false }) }))}
            ${detailMetric(T('todayUsed'), T('cacheHitRate', { v: formatCacheHitRate(today.cachedInputTokens, today.inputTokens) }))}
            ${detailMetric(T('windowUsed', { n: windowDays }), T('cacheHitRate', { v: formatCacheHitRate(totalCachedInput, totalInput) }))}
            ${detailMetric(formatMonthDay(selectedDay.day), `${detailSessions} · ${detailCache}`)}
          </dl>
          <p class="detail-note">${escapeHtml(costLine)}</p>
          <p class="detail-note">${escapeHtml(T('costHint'))}</p>
        </div>
      </details>
    </section>
  `;
  if (updateHtml(els.tokenActivity, markup)) {
    activeTokenBar = null;
    hideChartTooltip();
  }
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
      models: Array.isArray(source.models) ? source.models : [],
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
      models: [],
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
  if (provider === 'claude') {
    if (els.resetTitle) els.resetTitle.textContent = T('resetTitleClaude');
    renderClaudeNotes(state.claudeRadar?.data);
    return;
  }

  if (els.resetTitle) els.resetTitle.textContent = T('resetTitleCodex');
  const usageState = state.usage;
  const credits = usageState.data?.resetCredits;
  if (!credits) {
    els.resetCards.innerHTML = emptyBlock(T('noResetCards'));
    return;
  }

  if (credits.error) {
    els.resetCards.innerHTML = emptyBlock(credits.error);
    return;
  }

  if (!credits.credits.length) {
    els.resetCards.innerHTML = emptyBlock(T('creditsAvailable', { n: credits.availableCount ?? 0 }));
    return;
  }

  els.resetCards.innerHTML = `
    <div class="reset-timeline">
      <div class="reset-timeline-summary">
        <span>${escapeHtml(T('resetTimelineTitle'))}</span>
        <strong>${escapeHtml(T('creditsAvailable', { n: credits.availableCount ?? credits.credits.length }))}</strong>
      </div>
      <div class="reset-timeline-list">
        ${credits.credits.map((credit) => resetTimelineItemTemplate(
          credit.title || 'Codex reset',
          statusLabel(credit.status),
          credit.expiresAt ? T('expiresAt', { t: formatDateTime(credit.expiresAt) }) : T('noExpiry'),
          resetStatusClass(credit.status)
        )).join('')}
      </div>
    </div>
  `;
}

function renderClaudeNotes(radar) {
  if (!radar) {
    els.resetCards.innerHTML = emptyBlock(T('noRadarNotes'));
    return;
  }
  const quota = radar.quota || {};
  const calibratedAt = formatRadarUpdateLabel(quota.updatedAt, radar.updatedAt);
  els.resetCards.innerHTML = `
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
  return ['available', 'redeemed', 'expired'].includes(status) ? status : 'neutral';
}

function renderIq(radarState, provider) {
  const radar = radarState?.data;
  els.modelCatalogNotice.hidden = true;
  els.radarDataNotice.hidden = true;
  els.radarBriefStatus.hidden = true;
  if (!radar) {
    if (els.iqDate) els.iqDate.textContent = '';
    renderRadarSummary([], provider);
    updateHtml(els.iqGrid, emptyBlock(radarState?.error || T('noIqData')));
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
  if (els.iqDate) els.iqDate.textContent = updatedLabel
    ? T(radar.modelIq?.timestampBasis === 'read' ? 'radarReadAt' : 'lastUpdated', { t: updatedLabel }) : '';
  renderIqCards(provider === 'claude' ? radar.items || [] : radar.modelIq.items || [], provider);
  const updatedAt = provider === 'claude' ? radar.iqUpdatedAt || radar.updatedAt
    : radar.modelIq.updatedAt || radar.modelIq.latestDate;
  const timestamp = Date.parse(updatedAt);
  const notices = [];
  if (radar.modelIq?.scoreMode === 'radar-bench-v2-150') {
    notices.push(T('radarBenchNotice'));
    if (radar.modelIq.partial) notices.push(T('radarPartialRead', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }));
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
  els.radarDataNotice.classList.toggle('info', radar.modelIq?.scoreMode === 'radar-bench-v2-150' && !radarState.error);
  const stale = Number.isFinite(timestamp) && Date.now() - timestamp > 72 * 3600_000;
  const partial = radar.modelIq?.partial;
  els.radarBriefStatus.hidden = !radarState.error && !stale && !partial;
  els.radarBriefStatus.textContent = radarState.error || stale ? T('radarAttention')
    : partial ? T('radarPartialShort', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }) : '';
}

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

function sortRadarItems(items, sort) {
  return items.slice().sort((left, right) => {
    if (sort === 'value') {
      const valueOrder = compareRadarNumbers(radarValueScore(left), radarValueScore(right));
      if (valueOrder !== 0) return valueOrder;
    } else if (sort === 'speed') {
      const speedOrder = compareRadarNumbers(radarAverageSeconds(left), radarAverageSeconds(right), { ascending: true });
      if (speedOrder !== 0) return speedOrder;
    }

    const iqOrder = compareRadarNumbers(radarScore(left), radarScore(right));
    if (iqOrder !== 0) return iqOrder;
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
          ${detailMetric(T(item.sampleBasis === 'graded' ? 'iqColumnGradedSamples' : 'iqColumnSamples'), radarMetricText(formatSampleCount(item)))}
          ${detailMetric(T('metricCoverage'), formatPassedRatio(item))}
        </dl>
        ${item.costBasis === 'official_standard_api_equivalent' ? `<p class="detail-note">${escapeHtml(T('radarCostEvidence', { n: item.costKnownSamples ?? '-', total: item.costTotalSamples ?? '-' }))}</p>` : ''}
      </div>
    </details>
  `;
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
    els.quotaRows.innerHTML = emptyBlock(radarState.error || T('noQuotaRadar'));
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
        <i class="chart-tooltip-model-dot tone-${index % 5}" aria-hidden="true"></i>
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

function hideChartTooltip() {
  if (!els.chartTooltip) return;
  if (tooltipFrame) window.cancelAnimationFrame(tooltipFrame);
  tooltipFrame = null;
  tooltipBar = null;
  tooltipPointer = null;
  tooltipSize = null;
  els.chartTooltip.classList.remove('visible');
}

function statusLabel(status) {
  const keys = {
    available: 'statusAvailable',
    redeemed: 'statusRedeemed',
    expired: 'statusExpired'
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

function formatModelName(value) {
  const raw = String(value || '').replace(/-(\d{8})$/, '');
  const claudeMatch = raw.match(/^claude-([a-z]+)-(\d+(?:-\d+)*)$/i);
  if (claudeMatch) {
    const family = claudeMatch[1];
    const version = claudeMatch[2].split('-').join('.');
    return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${version}`;
  }
  if (/^gpt-/i.test(raw)) return raw.replace(/^gpt/i, 'GPT');
  return raw.replace(/^claude-/i, '');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatReset(value) {
  if (!value) return T('noResetFooter');
  const diffMs = Number(value) - Date.now();
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
