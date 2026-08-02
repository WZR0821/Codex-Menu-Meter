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
  refresh: document.getElementById('refresh'),
  statusLine: document.getElementById('statusLine'),
  providerSwitch: document.getElementById('providerSwitch'),
  tabUsageLabel: document.getElementById('tabUsageLabel'),
  tabRadarLabel: document.getElementById('tabRadarLabel'),
  usageTitle: document.getElementById('usageTitle'),
  tokenTitle: document.getElementById('tokenTitle'),
  trendTitle: document.getElementById('trendTitle'),
  usageTrend: document.getElementById('usageTrend'),
  iqTitle: document.getElementById('iqTitle'),
  quotaRadarTitle: document.getElementById('quotaRadarTitle'),
  resetTitle: document.getElementById('resetTitle'),
  quotaSource: document.getElementById('quotaSource'),
  usageUpdated: document.getElementById('usageUpdated'),
  meters: document.getElementById('meters'),
  tokenUpdated: document.getElementById('tokenUpdated'),
  tokenActivity: document.getElementById('tokenActivity'),
  iqDate: document.getElementById('iqDate'),
  iqGrid: document.getElementById('iqGrid'),
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
let scrollEdgeLock = null;
let providerSwitching = false;
const tabByProvider = {};

function T(key, params) {
  return I18N.t(lang, key, params);
}

function currentProviderKey() {
  return currentState?.provider || els.panel.dataset.provider || 'codex';
}

els.tabs.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

els.providerSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('.provider-option');
  if (button && els.providerSwitch.contains(button)) handleProviderClick(button.dataset.provider);
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
  const savedTab = tabByProvider[provider] || 'usage';
  if (els.panel.dataset.activeTab !== savedTab) {
    setActiveTab(savedTab, { provider, animate: false, renderContent: false });
  }
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

function revealActivePanel({ celebrate = false, details = true } = {}) {
  const activePanel = els.panels.find((panel) => panel.classList.contains('active'));
  if (!activePanel || reduceMotion.matches) return;
  revealAnimations.forEach((animation) => animation.cancel());
  revealAnimations = [...activePanel.querySelectorAll(':scope > .section')].map((section, index) => animateOne(section, [
    { opacity: 0.08, transform: `translate3d(0, ${celebrate ? 13 : 8}px, 0) scale(${celebrate ? 0.975 : 0.988})` },
    { opacity: 1, transform: 'translate3d(0, -1px, 0) scale(1.004)', offset: 0.72 },
    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
  ], {
    duration: celebrate ? 390 : 290,
    delay: index * (celebrate ? 54 : 36),
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    fill: 'backwards'
  })).filter(Boolean);
  if (details) animatePanelDetails(activePanel, { celebrate });
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
    els.providerSwitch.innerHTML = '<span class="provider-thumb" aria-hidden="true"></span>'
      + list.map((id) => `<button class="provider-option" type="button" data-provider="${id}">${escapeHtml(PROVIDER_LABELS[id] || id)}</button>`).join('');
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
  playRefreshEffect();
  els.refresh.classList.add('spinning');
  try {
    const state = await window.codexMeter.refresh();
    requestRender(state);
  } finally {
    els.refresh.classList.remove('spinning');
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

function setActiveTab(tab, {
  provider = currentProviderKey(),
  animate = true,
  renderContent = true
} = {}) {
  tabByProvider[provider] = tab;
  const changed = els.panel && els.panel.dataset.activeTab !== tab;
  if (els.panel) els.panel.dataset.activeTab = tab;
  if (changed && renderContent && currentState) renderVisibleContent(currentState, tab);
  els.tabs.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  els.panels.forEach((panel) => panel.classList.toggle('active', panel.id === `${tab}Panel`));
  if (changed && animate) {
    revealActivePanel({ details: false });
    playTabSwitchEffect();
  }
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
  lang = I18N.normalizeLanguage(state.language);
  document.documentElement.lang = lang;
  applyStaticText();
  const provider = state.provider || 'codex';
  const isExtra = EXTRA_PROVIDER_IDS.includes(provider);
  els.panel.classList.toggle('extra-provider', isExtra);
  if (previousProvider && previousProvider !== provider) {
    const savedTab = isExtra ? 'usage' : tabByProvider[provider] || 'usage';
    setActiveTab(savedTab, { provider, animate: false, renderContent: false });
  } else if (isExtra && els.panel.dataset.activeTab === 'radar') {
    setActiveTab('usage', { provider, animate: false, renderContent: false });
  }
  syncProviderUi(provider);
  const slices = activeSlices(state);
  renderHeader(slices);
  renderVisibleContent(state, els.panel.dataset.activeTab || 'usage', slices);
  if (previousProvider && previousProvider !== provider) {
    revealActivePanel({ celebrate: true, details: false });
    playProviderSwitchEffect(previousProvider, provider);
  }
}

function renderVisibleContent(stateValue, tab, providedSlices = null) {
  const provider = stateValue.provider || 'codex';
  const isExtra = EXTRA_PROVIDER_IDS.includes(provider);
  const slices = providedSlices || activeSlices(stateValue);
  if (tab === 'usage') {
    renderMeters(slices.usage, provider);
    if (isExtra) return;
    renderTrend(stateValue, slices.usage, provider);
    renderTokenActivity(slices.activity);
    return;
  }
  if (!isExtra) {
    renderIq(slices.radar, provider);
    renderQuota(slices.radar, provider);
    renderResetCards(stateValue, provider);
  }
}

// ---- 24 小时额度曲线 + 燃烧率预测 ----

const TREND_W = 372;
const TREND_H = 72;
const TREND_PAD = 4;

function renderTrend(state, usageState, provider) {
  if (!els.usageTrend) return;
  const history = (state.usageHistory && state.usageHistory[provider]) || [];
  const hasFive = history.some((s) => Number.isFinite(s.five));
  const hasWeek = history.some((s) => Number.isFinite(s.week));
  const usable = history.filter((s) => Number.isFinite(s.five) || Number.isFinite(s.week));

  const burnFive = hasFive ? computeBurn(history, 'five', 90 * 60_000) : null;
  const burnWeek = hasWeek ? computeBurn(history, 'week', 12 * 3600_000) : null;
  const usage = usageState.data;
  const lines = [
    burnText(T('windowName5h'), burnFive, usage?.primaryWindow?.resetAt),
    burnText(T('windowNameWeek'), burnWeek, usage?.secondaryWindow?.resetAt)
  ].filter(Boolean);

  if (usable.length < 3) {
    els.usageTrend.innerHTML = emptyBlock(T('trendEmpty'));
    return;
  }

  // 图例只显示真正画出来的线（比如 Codex 已取消 5 小时限制时就只剩周线）。
  const legendParts = [];
  if (hasFive) legendParts.push(`<span class="trend-dot trend-dot-five"></span>${escapeHtml(T('windowName5h'))}`);
  if (hasWeek) legendParts.push(`<span class="trend-dot trend-dot-week"></span>${escapeHtml(T('windowNameWeek'))}`);

  els.usageTrend.innerHTML = `
    <section class="trend-card">
      <svg viewBox="0 0 ${TREND_W} ${TREND_H}" preserveAspectRatio="none" aria-hidden="true">
        <line class="trend-grid" x1="0" y1="${trendY(50)}" x2="${TREND_W}" y2="${trendY(50)}" />
        ${trendPath(usable, 'week', 'trend-week')}
        ${trendPath(usable, 'five', 'trend-five')}
      </svg>
      <div class="trend-legend">${legendParts.join('')}</div>
      ${lines.map((line) => `<p class="trend-line">${escapeHtml(line)}</p>`).join('')}
    </section>
  `;
}

function trendY(usedPercent) {
  const usable = TREND_H - TREND_PAD * 2;
  return TREND_PAD + usable - (clamp(usedPercent, 0, 100) / 100) * usable;
}

function trendPath(samples, key, className) {
  const now = Date.now();
  const start = now - 24 * 3600_000;
  const points = samples
    .filter((s) => Number.isFinite(s[key]))
    .map((s) => {
      const x = ((s.t - start) / (24 * 3600_000)) * TREND_W;
      return `${Math.max(0, Math.min(TREND_W, x)).toFixed(1)},${trendY(s[key]).toFixed(1)}`;
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
  if (els.tabUsageLabel) els.tabUsageLabel.textContent = T('tabUsage');
  if (els.tabRadarLabel) els.tabRadarLabel.textContent = T('tabRadar');
  if (els.tokenTitle) els.tokenTitle.textContent = T('tokenTitle');
  if (els.trendTitle) els.trendTitle.textContent = T('trendTitle');
  if (els.iqTitle) els.iqTitle.textContent = T('iqTitle');
  if (els.quotaRadarTitle) els.quotaRadarTitle.textContent = T('quotaRadarTitle');
  if (els.openRadar) els.openRadar.textContent = T('openSource');
}

function renderHeader(slices) {
  const usage = slices.usage;
  const radar = slices.radar;
  const token = slices.activity;
  const statusParts = [];
  if (usage.status === 'ok') statusParts.push(T('statusUsage', { time: formatClock(usage.fetchedAt) }));
  if (usage.status === 'loading') statusParts.push(T('statusUsageLoading'));
  if (usage.status === 'refreshing') statusParts.push(T('statusUsageRefreshing'));
  if (usage.status === 'error') statusParts.push(usage.error || T('statusUsageFailed'));
  if (token.status === 'ok') statusParts.push(T('statusToken', { time: formatClock(token.fetchedAt) }));
  if (radar.status === 'ok') statusParts.push(T('statusRadar', { time: formatClock(radar.fetchedAt) }));
  if (radar.status === 'loading') statusParts.push(T('statusRadarLoading'));
  if (radar.status === 'refreshing') statusParts.push(T('statusRadarRefreshing'));
  if (radar.status === 'error') statusParts.push(radar.error || T('statusRadarFailed'));
  els.statusLine.textContent = statusParts.join(' · ') || T('statusWaiting');
}

function renderMeters(usageState, provider) {
  const usage = usageState.data;
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
    els.meters.innerHTML = emptyBlock(usageState.error || T('noUsageData'));
    return;
  }

  const cards = [];
  if (usage.fiveHourUnlimited) {
    cards.push(unlimitedCardTemplate(T('label5h')));
  } else if (usage.primaryWindow || !isExtra) {
    cards.push(quotaCardTemplate(usage.primaryWindow, T('label5h'), { provider }));
  }
  if (usage.secondaryWindow || !isExtra) {
    cards.push(quotaCardTemplate(usage.secondaryWindow, T('labelWeek'), { provider }));
  }
  (usage.extraWindows || []).forEach((windowValue) => {
    const label = isExtra
      ? String(windowValue.name || '').trim() || T('labelWeek')
      : `${T('labelWeek')} ${windowValue.name || ''}`.trim();
    cards.push(quotaCardTemplate(windowValue, label, { provider }));
  });
  els.meters.innerHTML = cards.length ? cards.join('') : emptyBlock(T('windowUnavailable'));
  animateQuotaNumbers();
}

function formatPlanType(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function quotaCardTemplate(windowValue, label, { provider = 'codex' } = {}) {
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
  const resetClock = windowValue.resetAt
    ? formatResetClock(windowValue.resetAt)
    : inactive
      ? T('notStarted')
      : T('noneShort');
  return `
    <article class="quota-card${critical ? ' critical' : ''}" style="--quota-percent:${remaining}%;">
      <div class="quota-card-top">
        <span>${escapeHtml(T('remainingTitle', { label }))}</span>
        <em>${escapeHtml(resetClock)}</em>
      </div>
      <strong data-quota-key="${escapeHtml(`${provider}:${label}`)}" data-quota-value="${remaining}">${remaining}%</strong>
      <div class="quota-progress" aria-hidden="true">
        <i></i>
        <span class="quota-flare"></span>
      </div>
      <small>${escapeHtml(footer)}</small>
    </article>
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
    if (!Number.isFinite(from) || from === target || document.hidden) return;
    const startedAt = performance.now();
    const duration = 720;
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
      rendererReadySent = true;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.codexMeter.markPanelReady());
      });
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
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
        { opacity: 0, transform: 'translate3d(0, -7px, 0) scale(0.97)' }
      ]
    : [
        { opacity: 0, transform: 'translate3d(0, -12px, 0) scale(0.945)' },
        { opacity: 1, transform: 'translate3d(0, 1px, 0) scale(1.01)', offset: 0.68 },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
      ], {
    duration: closing ? 160 : 410,
    easing: closing ? 'ease-in' : 'cubic-bezier(0.16, 1, 0.3, 1)',
    fill: closing ? 'forwards' : 'none'
  });
  if (!closing) window.requestAnimationFrame(playPanelOpeningSequence);
}

function playPanelOpeningSequence() {
  if (reduceMotion.matches || document.hidden) return;
  playAccentSweep({ strength: 1 });
  animateOne(els.toolbar, [
    { opacity: 0, transform: 'translate3d(0, -10px, 0) scale(0.985)' },
    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
  ], { duration: 330, delay: 35, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
  animateOne(els.statusLine, [
    { opacity: 0, transform: 'scaleX(0.82)' },
    { opacity: 1, transform: 'scaleX(1)' }
  ], { duration: 340, delay: 95, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
  revealActivePanel({ celebrate: true, details: false });
}

function playProviderSwitchEffect(previousProvider, provider) {
  if (reduceMotion.matches || document.hidden) return;
  const thumb = els.providerSwitch.querySelector('.provider-thumb');
  const activeButton = els.providerSwitch.querySelector('.provider-option.active');
  playAccentSweep({ strength: 0.9 });
  animateOne(els.providerSwitch, [
    { transform: 'scale(0.992)', opacity: 0.82 },
    { transform: 'scale(1.012)', opacity: 1, offset: 0.48 },
    { transform: 'scale(1)', opacity: 1 }
  ], { duration: 430, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  animateOne(thumb, [
    { scale: '0.72', opacity: 0.45 },
    { scale: '1.12', opacity: 1, offset: 0.62 },
    { scale: '1', opacity: 1 }
  ], { duration: 430, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  animateOne(activeButton, [
    { transform: 'scale(0.88)', opacity: 0.62 },
    { transform: 'scale(1.08)', opacity: 1, offset: 0.58 },
    { transform: 'scale(1)', opacity: 1 }
  ], { duration: 390, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  emitProviderTrail(previousProvider, provider);
}

function playRefreshEffect() {
  if (reduceMotion.matches || document.hidden) return;
  playAccentSweep({ strength: 0.72 });
  animateOne(els.refresh, [
    { transform: 'scale(0.84)', opacity: 0.62 },
    { transform: 'scale(1.11)', opacity: 1, offset: 0.48 },
    { transform: 'scale(1)', opacity: 1 }
  ], { duration: 450, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  emitEnergySparks(els.refresh, 6);
  playStatusComet();
}

function playTabSwitchEffect() {
  if (reduceMotion.matches || document.hidden) return;
  const activeTab = els.tabs.find((tab) => tab.classList.contains('active'));
  playAccentSweep({ strength: 0.52 });
  animateOne(activeTab, [
    { transform: 'scale(0.92)', opacity: 0.62 },
    { transform: 'scale(1.06)', opacity: 1, offset: 0.56 },
    { transform: 'scale(1)', opacity: 1 }
  ], { duration: 360, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
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
  if (!fromButton || !toButton) return;
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
      { opacity: 0.46 - index * 0.1, offset: 0.18 },
      { opacity: 0.18, transform: `translate3d(${dx}px, ${dy}px, 0) scale(1.06)`, offset: 0.8 },
      { opacity: 0, transform: `translate3d(${dx}px, ${dy}px, 0) scale(1.1)` }
    ], {
      duration: 560,
      delay: index * 58,
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

function unlimitedCardTemplate(label) {
  return `
    <article class="quota-card" style="--quota-percent:100%;">
      <div class="quota-card-top">
        <span>${escapeHtml(T('remainingTitle', { label }))}</span>
        <em>∞</em>
      </div>
      <strong>${escapeHtml(T('unlimitedBadge'))}</strong>
      <div class="quota-progress" aria-hidden="true">
        <i></i>
        <span class="quota-flare"></span>
      </div>
      <small>${escapeHtml(T('unlimitedFooter'))}</small>
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
    els.tokenActivity.innerHTML = emptyBlock(tokenState.error || T('noTokenData'));
    return;
  }
  if (activity.units !== 'tokens' || !isLocalActivitySource(activity.source)) {
    els.tokenActivity.innerHTML = emptyBlock(T('noTokenData'));
    return;
  }

  const heatmap = createTokenHeatmap(activity.days || []);
  const today = heatmap.today;
  const windowDays = Number(activity.windowDays) || 30;
  const totalIo = heatmap.days.reduce((sum, day) => sum + Number(day.ioTokens || 0), 0);
  const totalTokens = heatmap.days.reduce((sum, day) => sum + Number(day.tokens || 0), 0);
  const totalInput = heatmap.days.reduce((sum, day) => sum + Number(day.inputTokens || 0), 0);
  const totalCachedInput = heatmap.days.reduce((sum, day) => sum + Number(day.cachedInputTokens || 0), 0);
  let statsHtml = `
    <div>
      <span>${escapeHtml(T('todayUsed'))}</span>
      <strong>${escapeHtml(formatTokenCount(today.tokens))}</strong>
      <small>${escapeHtml(T('ioAmount', { v: formatTokenCount(today.ioTokens, { withUnit: false }) }))}</small>
      <small class="cache-hit-rate" title="${escapeHtml(T('cacheHitHint'))}">${escapeHtml(T('cacheHitRate', { v: formatCacheHitRate(today.cachedInputTokens, today.inputTokens) }))}</small>
    </div>
    <div>
      <span>${escapeHtml(T('windowUsed', { n: windowDays }))}</span>
      <strong>${escapeHtml(formatTokenCount(totalTokens))}</strong>
      <small>${escapeHtml(T('ioAmount', { v: formatTokenCount(totalIo, { withUnit: false }) }))}</small>
      <small class="cache-hit-rate" title="${escapeHtml(T('cacheHitHint'))}">${escapeHtml(T('cacheHitRate', { v: formatCacheHitRate(totalCachedInput, totalInput) }))}</small>
    </div>
  `;
  const detailText = `${formatMonthDay(today.day)} · ${formatTokenCount(today.tokens)}`;
  const detailMeta = `${T('sessionsCount', { n: Number(today.threads || 0) })} · ${T('cacheHitRate', {
    v: formatCacheHitRate(today.cachedInputTokens, today.inputTokens)
  })}`;
  const totalCost = heatmap.days.reduce((sum, day) => sum + Number(day.costUsd || 0), 0);
  statsHtml += `
    <div class="token-cost" title="${escapeHtml(T('costHint'))}">${escapeHtml(T('costLine', {
      today: formatCostUsd(today.costUsd),
      n: windowDays,
      total: formatCostUsd(totalCost)
    }))}</div>
  `;

  els.tokenActivity.innerHTML = `
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
              class="token-heatmap-cell${day.future ? ' future' : ''}"
              data-level="${day.level}"
              data-day="${escapeHtml(day.day)}"
              data-tokens="${escapeHtml(T('usedAmount', { v: formatTokenCount(day.tokens) }))}"
              data-cost="${escapeHtml(cellSecondaryText(day))}"
              data-threads="${escapeHtml(cellMetaText(day))}"
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
      </div>
      <div class="token-detail">
        <strong>${escapeHtml(detailText)}</strong>
        <span>${escapeHtml(detailMeta)}</span>
      </div>
    </section>
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

  els.resetCards.innerHTML = credits.credits.map((credit) => `
    <article class="reset-item">
      <div>
        <strong>${escapeHtml(credit.title || 'Codex reset')}</strong>
        <span>${escapeHtml(statusLabel(credit.status))}</span>
      </div>
      <p>${credit.expiresAt ? escapeHtml(T('expiresAt', { t: formatDateTime(credit.expiresAt) })) : escapeHtml(T('noExpiry'))}</p>
    </article>
  `).join('');
}

function renderClaudeNotes(radar) {
  if (!radar) {
    els.resetCards.innerHTML = emptyBlock(T('noRadarNotes'));
    return;
  }
  const quota = radar.quota || {};
  const calibratedAt = formatRadarUpdateLabel(quota.updatedAt, radar.updatedAt);
  els.resetCards.innerHTML = `
    <article class="reset-item">
      <div>
        <strong>${escapeHtml(T('calibTitle'))}</strong>
        <span>${escapeHtml(calibratedAt || '--')}</span>
      </div>
      <p>${escapeHtml(quota.chartLabel || quota.note || T('calibNone'))}</p>
    </article>
    <article class="reset-item">
      <div>
        <strong>${escapeHtml(T('srcTitle'))}</strong>
        <span>claudecoderadar.com</span>
      </div>
      <p>${escapeHtml(T('attributionClaude'))}</p>
    </article>
  `;
}

function renderIq(radarState, provider) {
  const radar = radarState.data;
  if (!radar) {
    els.iqDate.textContent = '';
    els.iqGrid.innerHTML = emptyBlock(radarState.error || T('noIqData'));
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
  els.iqDate.textContent = updatedLabel ? T('lastUpdated', { t: updatedLabel }) : '';
  renderIqCards(provider === 'claude' ? radar.items || [] : radar.modelIq.items || []);
}

function renderIqCards(items) {
  if (!items.length) {
    els.iqGrid.innerHTML = emptyBlock(T('noIqData'));
    return;
  }

  els.iqGrid.innerHTML = items.map((item) => `
    <article class="iq-card ${escapeHtml(item.status || 'unknown')}" title="${escapeHtml(item.label)}">
      <div class="iq-card-body">
        <div class="iq-model-row">
          <strong class="iq-model-name">${escapeHtml(item.modelLabel || item.label)}</strong>
          ${item.reasoningEffort ? `<span class="iq-effort">${escapeHtml(item.reasoningEffort)}</span>` : ''}
          ${item.status === 'invalid' || Number(item.invalid || 0) > 0 ? `<span class="iq-alert">${escapeHtml(T('badSample'))}</span>` : ''}
        </div>
        <div class="iq-meta">
          <span>${escapeHtml(T('passedRatio', { p: item.passed ?? '-', t: item.tasks ?? '-' }))}</span>
          <span>${formatMoney(item.costUsd)}</span>
          <span>${escapeHtml(iqWallTime(item))}</span>
        </div>
      </div>
      <div class="iq-score">
        <span>IQ</span>
        <strong>${Number.isFinite(Number(item.score)) ? Number(item.score).toFixed(1) : '--'}</strong>
      </div>
    </article>
  `).join('');
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

function renderQuota(radarState, provider) {
  const radar = radarState.data;
  if (els.quotaSource) els.quotaSource.textContent = provider === 'claude' ? 'Claude Code Radar' : 'Codex Radar';
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

function showChartTooltip(bar, event) {
  if (!els.chartTooltip || !bar) return;
  els.chartTooltip.innerHTML = `
    <strong>${escapeHtml(bar.dataset.day || '-')}</strong>
    <span>${escapeHtml(bar.dataset.tokens || '-')}</span>
    ${bar.dataset.cost ? `<span>${escapeHtml(bar.dataset.cost)}</span>` : ''}
    <span>${escapeHtml(bar.dataset.threads || T('sessionsCount', { n: 0 }))}</span>
  `;
  els.chartTooltip.classList.add('visible');
  const tooltipBounds = els.chartTooltip.getBoundingClientRect();
  const margin = 10;
  const x = Math.min(
    window.innerWidth - tooltipBounds.width - margin,
    Math.max(margin, event.clientX + 12)
  );
  const y = Math.min(
    window.innerHeight - tooltipBounds.height - margin,
    Math.max(margin, event.clientY - tooltipBounds.height - 12)
  );
  els.chartTooltip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function hideChartTooltip() {
  if (!els.chartTooltip) return;
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

function formatCacheHitRate(cachedInputTokens, inputTokens) {
  const cached = Number(cachedInputTokens);
  const input = Number(inputTokens);
  if (!Number.isFinite(cached) || !Number.isFinite(input) || input <= 0) return '--';
  const rate = clamp((cached / input) * 100, 0, 100);
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(rate)}%`;
}

function cellSecondaryText(day) {
  const parts = [];
  if (Number(day.ioTokens || 0) > 0) parts.push(T('ioAmount', { v: formatTokenCount(day.ioTokens) }));
  if (day.inputTokens !== null) {
    parts.push(T('cacheHitRate', { v: formatCacheHitRate(day.cachedInputTokens, day.inputTokens) }));
  }
  return parts.join(' · ');
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
