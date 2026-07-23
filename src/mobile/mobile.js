const TEXT = {
  'zh-CN': {
    connecting: '正在连接 Mac',
    live: 'Mac 在线 · 实时同步',
    offline: 'Mac 已离线',
    usage: '用量',
    radar: '雷达',
    usageTitle: '{name} 额度',
    tokenTitle: 'Token 活动',
    iqTitle: '今日 IQ',
    radarTitle: '额度雷达',
    recentDays: '近 30 天',
    updated: '更新 {time}',
    remaining: '{label} 剩余',
    label5h: '5 小时',
    labelWeek: '一周',
    noReset: '暂无重置时间',
    resetAt: '{time} 重置',
    today: '今日 Token',
    total: '近 30 天',
    io: 'I/O {value}',
    sessions: '{count} 个会话',
    cost: '约 {value}',
    noData: '暂无数据',
    passed: '{passed}/{tasks} 通过',
    readOnly: '只读安全连接',
    refreshing: '正在让 Mac 刷新数据',
    refreshFailed: '刷新请求失败',
    unauthorized: '访问密钥无效，请从电脑端重新复制链接',
    sourceCodex: 'Codex Radar',
    sourceClaude: 'Claude Radar',
    measured: '实测额度',
    sharedUsed: '共享用量',
    reset: '重置',
    tier: '套餐',
    unavailable: '不可用'
  },
  'en-US': {
    connecting: 'Connecting to Mac',
    live: 'Mac online · Live sync',
    offline: 'Mac offline',
    usage: 'Usage',
    radar: 'Radar',
    usageTitle: '{name} quota',
    tokenTitle: 'Token activity',
    iqTitle: "Today's IQ",
    radarTitle: 'Quota radar',
    recentDays: 'Last 30 days',
    updated: 'Updated {time}',
    remaining: '{label} left',
    label5h: '5 hours',
    labelWeek: 'One week',
    noReset: 'No reset time',
    resetAt: 'Resets {time}',
    today: 'Today',
    total: 'Last 30 days',
    io: 'I/O {value}',
    sessions: '{count} sessions',
    cost: 'Approx. {value}',
    noData: 'No data yet',
    passed: '{passed}/{tasks} passed',
    readOnly: 'Secure read-only link',
    refreshing: 'Refreshing data on Mac',
    refreshFailed: 'Refresh request failed',
    unauthorized: 'Invalid access key. Copy a new link from the Mac app.',
    sourceCodex: 'Codex Radar',
    sourceClaude: 'Claude Radar',
    measured: 'Measured',
    sharedUsed: 'Shared use',
    reset: 'Reset',
    tier: 'Tier',
    unavailable: 'Unavailable'
  },
  'ja-JP': {
    connecting: 'Mac に接続中',
    live: 'Mac オンライン · ライブ同期',
    offline: 'Mac オフライン',
    usage: '使用量',
    radar: 'レーダー',
    usageTitle: '{name} クォータ',
    tokenTitle: 'Token アクティビティ',
    iqTitle: '今日の IQ',
    radarTitle: 'クォータレーダー',
    recentDays: '直近 30 日',
    updated: '{time} 更新',
    remaining: '{label} 残量',
    label5h: '5 時間',
    labelWeek: '1 週間',
    noReset: 'リセット時刻なし',
    resetAt: '{time} リセット',
    today: '今日の Token',
    total: '直近 30 日',
    io: 'I/O {value}',
    sessions: '{count} セッション',
    cost: '約 {value}',
    noData: 'データがありません',
    passed: '{passed}/{tasks} 合格',
    readOnly: '安全な読み取り専用接続',
    refreshing: 'Mac のデータを更新中',
    refreshFailed: '更新リクエストに失敗',
    unauthorized: 'アクセスキーが無効です。Mac からリンクを再取得してください。',
    sourceCodex: 'Codex Radar',
    sourceClaude: 'Claude Radar',
    measured: '実測',
    sharedUsed: '共有使用量',
    reset: 'リセット',
    tier: 'プラン',
    unavailable: '利用不可'
  }
};

const els = {
  connectionLabel: document.getElementById('connectionLabel'),
  refreshButton: document.getElementById('refreshButton'),
  providerSwitch: document.getElementById('providerSwitch'),
  viewSwitch: document.querySelector('.view-switch'),
  viewButtons: [...document.querySelectorAll('.view-button')],
  views: [...document.querySelectorAll('.view')],
  usageHeading: document.getElementById('usageHeading'),
  usageUpdated: document.getElementById('usageUpdated'),
  quotaGrid: document.getElementById('quotaGrid'),
  tokenUpdated: document.getElementById('tokenUpdated'),
  tokenCard: document.getElementById('tokenCard'),
  iqUpdated: document.getElementById('iqUpdated'),
  iqList: document.getElementById('iqList'),
  radarSource: document.getElementById('radarSource'),
  radarCard: document.getElementById('radarCard'),
  footerStatus: document.getElementById('footerStatus'),
  toast: document.getElementById('toast')
};

let accessToken = '';
let currentState = null;
let provider = 'codex';
let activeView = 'usage';
let eventSource = null;
let reconnectTimer = null;
let toastTimer = null;
let motionTimer = null;
let lang = 'zh-CN';

function T(key, params = {}) {
  const table = TEXT[lang] || TEXT['zh-CN'];
  return String(table[key] || TEXT['zh-CN'][key] || key).replace(/\{(\w+)\}/g, (_match, name) => params[name] ?? '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readAccessToken() {
  const queryToken = new URLSearchParams(location.search).get('token') || '';
  const hashToken = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const urlToken = queryToken || hashToken;
  if (urlToken) {
    localStorage.setItem('cmm-mobile-token', urlToken);
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = `/mobile/manifest.webmanifest?token=${encodeURIComponent(urlToken)}`;
  }
  return urlToken || localStorage.getItem('cmm-mobile-token') || '';
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(path, { ...options, headers, cache: 'no-store' });
  if (response.status === 401) throw new Error('unauthorized');
  if (!response.ok) throw new Error(`http_${response.status}`);
  return response.json();
}

function setConnection(connected) {
  document.body.classList.toggle('offline', !connected);
  els.connectionLabel.textContent = connected ? T('live') : T('offline');
}

function connectEvents() {
  eventSource?.close();
  clearTimeout(reconnectTimer);
  const eventUrl = accessToken
    ? `/api/events?token=${encodeURIComponent(accessToken)}`
    : '/api/events';
  eventSource = new EventSource(eventUrl);
  eventSource.addEventListener('state', (event) => {
    try {
      applyState(JSON.parse(event.data));
      setConnection(true);
    } catch {
      setConnection(false);
    }
  });
  eventSource.onerror = () => {
    setConnection(false);
    eventSource?.close();
    reconnectTimer = window.setTimeout(connectEvents, 5000);
  };
}

function applyState(state) {
  currentState = state;
  lang = TEXT[state.language] ? state.language : 'zh-CN';
  document.documentElement.lang = lang;
  const providerIds = Object.keys(state.providers || {});
  if (!providerIds.includes(provider)) provider = providerIds[0] || 'codex';
  renderStaticText();
  renderProviders(providerIds);
  render();
  if (!document.body.classList.contains('ready')) {
    window.requestAnimationFrame(() => {
      document.body.classList.add('ready');
      playMotionBurst();
    });
  }
}

function playMotionBurst() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  clearTimeout(motionTimer);
  document.body.classList.remove('motion-burst');
  window.requestAnimationFrame(() => {
    document.body.classList.add('motion-burst');
    motionTimer = window.setTimeout(() => document.body.classList.remove('motion-burst'), 700);
  });
}

function renderStaticText() {
  els.viewButtons[0].textContent = T('usage');
  els.viewButtons[1].textContent = T('radar');
  els.footerStatus.textContent = T('readOnly');
  document.querySelector('.token-heading h2').textContent = T('tokenTitle');
  document.querySelector('#radarView .section-head h2').textContent = T('iqTitle');
  document.querySelector('.radar-heading h2').textContent = T('radarTitle');
}

function renderProviders(providerIds) {
  const key = providerIds.join(',');
  if (els.providerSwitch.dataset.providers !== key) {
    els.providerSwitch.dataset.providers = key;
    els.providerSwitch.style.setProperty('--provider-count', providerIds.length || 1);
    els.providerSwitch.innerHTML = providerIds.map((id) => (
      `<button class="provider-button" type="button" data-provider="${escapeHtml(id)}">${escapeHtml(currentState.providers[id].label)}</button>`
    )).join('');
  }
  els.providerSwitch.style.setProperty('--provider-index', Math.max(0, providerIds.indexOf(provider)));
  els.providerSwitch.querySelectorAll('.provider-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.provider === provider);
  });
}

function render() {
  const providerData = currentState?.providers?.[provider];
  document.body.dataset.provider = provider;
  document.body.dataset.view = activeView;
  if (!providerData) return;
  els.usageHeading.textContent = T('usageTitle', { name: providerData.label });
  renderUsage(providerData.usage);
  renderActivity(providerData.activity);
  renderRadar(providerData.radar);
}

function renderUsage(usageSlice) {
  els.usageUpdated.textContent = formatUpdated(usageSlice?.fetchedAt);
  const usage = usageSlice?.data;
  if (!usage) {
    els.quotaGrid.innerHTML = empty(usageSlice?.error);
    return;
  }
  const cards = [];
  if (usage.fiveHourUnlimited) {
    cards.push(quotaTemplate({ remainingPercent: 100 }, T('label5h'), true));
  } else if (usage.primaryWindow) {
    cards.push(quotaTemplate(usage.primaryWindow, T('label5h')));
  }
  if (usage.secondaryWindow) cards.push(quotaTemplate(usage.secondaryWindow, T('labelWeek')));
  for (const windowValue of usage.extraWindows || []) {
    cards.push(quotaTemplate(windowValue, windowValue.name || T('labelWeek')));
  }
  els.quotaGrid.innerHTML = cards.length ? cards.join('') : empty(usageSlice?.error);
}

function quotaTemplate(windowValue, label, unlimited = false) {
  const remaining = unlimited ? 100 : clamp(Math.round(Number(windowValue.remainingPercent) || 0), 0, 100);
  const color = remaining <= 20 ? '#ff5f6d' : remaining <= 50 ? '#efc54b' : 'var(--accent)';
  const reset = unlimited ? '∞' : windowValue.resetAt ? formatClock(windowValue.resetAt) : '--';
  const footer = unlimited ? 'Unlimited' : windowValue.resetAt
    ? T('resetAt', { time: formatDateTime(windowValue.resetAt) })
    : T('noReset');
  return `
    <article class="quota-card" style="--quota:${remaining}%; --quota-color:${color}">
      <div class="quota-top">
        <span>${escapeHtml(T('remaining', { label }))}</span>
        <span class="quota-reset">${escapeHtml(reset)}</span>
      </div>
      <strong class="quota-value">${unlimited ? '∞' : `${remaining}%`}</strong>
      <div class="quota-progress"><i></i></div>
      <small>${escapeHtml(footer)}</small>
    </article>
  `;
}

function renderActivity(activitySlice) {
  const activity = activitySlice?.data;
  els.tokenUpdated.textContent = activity ? T('recentDays') : formatUpdated(activitySlice?.fetchedAt);
  if (!activity) {
    els.tokenCard.innerHTML = empty(activitySlice?.error);
    return;
  }
  const days = normalizeDays(activity.days || []);
  const today = days.at(-1) || emptyDay(new Date());
  const total = days.reduce((sum, day) => sum + day.tokens, 0);
  const totalIo = days.reduce((sum, day) => sum + day.ioTokens, 0);
  const max = Math.max(1, ...days.map((day) => day.tokens));

  els.tokenCard.innerHTML = `
    <div class="token-summary">
      <div>
        <span>${escapeHtml(T('today'))}</span>
        <strong>${escapeHtml(formatTokens(today.tokens))}</strong>
        <small>${escapeHtml(T('io', { value: formatTokens(today.ioTokens, false) }))}</small>
      </div>
      <div>
        <span>${escapeHtml(T('total'))}</span>
        <strong>${escapeHtml(formatTokens(total))}</strong>
        <small>${escapeHtml(T('io', { value: formatTokens(totalIo, false) }))}</small>
      </div>
    </div>
    <div class="heatmap">
      ${days.map((day) => `
        <button
          class="heat-cell${day.day === today.day ? ' active' : ''}"
          type="button"
          data-day="${escapeHtml(day.day)}"
          style="--level:${heatLevel(day.tokens, max)}"
          aria-label="${escapeHtml(day.day)}"
        >${escapeHtml(day.day.slice(-2).replace(/^0/, ''))}</button>
      `).join('')}
    </div>
    <div class="token-detail" id="tokenDetail">${tokenDetailTemplate(today)}</div>
  `;
}

function normalizeDays(rawDays) {
  const byDay = new Map(rawDays.map((day) => [day.day, day]));
  const days = [];
  const today = new Date();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = isoDate(date);
    const source = byDay.get(key) || {};
    days.push({
      day: key,
      tokens: Number(source.tokens ?? source.value ?? 0) || 0,
      ioTokens: Number(source.ioTokens || 0) || 0,
      threads: Number(source.threads || 0) || 0,
      costUsd: Number(source.costUsd || 0) || 0
    });
  }
  return days;
}

function tokenDetailTemplate(day) {
  return `
    <strong>${escapeHtml(`${formatDay(day.day)} · ${formatTokens(day.tokens)}`)}</strong>
    <span>${escapeHtml(`${T('sessions', { count: day.threads })} · ${T('cost', { value: formatUsd(day.costUsd) })}`)}</span>
  `;
}

function renderRadar(radarSlice) {
  const radar = radarSlice?.data;
  if (!radar) {
    els.iqUpdated.textContent = formatUpdated(radarSlice?.fetchedAt);
    els.radarSource.textContent = '--';
    els.iqList.innerHTML = empty(radarSlice?.error);
    els.radarCard.innerHTML = empty(radarSlice?.error);
    return;
  }
  const items = provider === 'claude' ? radar.items || [] : radar.modelIq?.items || [];
  const updatedAt = provider === 'claude'
    ? radar.iqUpdatedAt || radar.updatedAt
    : radar.modelIq?.updatedAt || radar.monitoredAt || radar.modelIq?.latestDate;
  els.iqUpdated.textContent = formatRadarTime(updatedAt);
  els.radarSource.textContent = provider === 'claude' ? T('sourceClaude') : T('sourceCodex');
  els.iqList.innerHTML = items.length ? items.slice(0, 8).map(iqTemplate).join('') : empty();
  els.radarCard.innerHTML = provider === 'claude'
    ? claudeRadarTemplate(radar.quota)
    : codexRadarTemplate(radar.quotaRadar);
}

function iqTemplate(item) {
  const score = Number(item.score);
  const rgb = item.status === 'red' ? '255, 95, 109' : item.status === 'yellow' ? '239, 197, 75' : '55, 223, 145';
  return `
    <article class="iq-item">
      <div class="iq-copy">
        <div class="iq-top">
          <strong class="iq-name">${escapeHtml(item.modelLabel || item.label)}</strong>
          ${item.reasoningEffort ? `<span class="iq-effort">${escapeHtml(item.reasoningEffort)}</span>` : ''}
        </div>
        <div class="iq-meta">
          <span>${escapeHtml(T('passed', { passed: item.passed ?? '-', tasks: item.tasks ?? '-' }))}</span>
          <span>${escapeHtml(formatUsd(item.costUsd))}</span>
          <span>${escapeHtml(item.wallTimeHuman || formatHours(item.wallHours))}</span>
        </div>
      </div>
      <div class="iq-score" style="--score-rgb:${rgb}">
        <span>IQ</span>
        <strong>${Number.isFinite(score) ? score.toFixed(1) : '--'}</strong>
      </div>
    </article>
  `;
}

function codexRadarTemplate(quotaRadar) {
  const rows = quotaRadar?.rows || [];
  if (!rows.length) return empty();
  return `
    <div class="radar-table">
      <div class="radar-row radar-head"><span>${escapeHtml(T('tier'))}</span><strong>5h</strong><strong>7d</strong></div>
      ${rows.map((row) => `
        <div class="radar-row">
          <span>${escapeHtml(row.tier || '-')}</span>
          <strong>${escapeHtml(formatUsd(row.five_h))}</strong>
          <strong>${escapeHtml(formatUsd(row.seven_d))}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function claudeRadarTemplate(quota) {
  if (!quota) return empty();
  const byKey = Object.fromEntries((quota.usage || []).map((row) => [row.key, row]));
  const rows = [
    [T('measured'), formatUsd(quota.baseH5), formatUsd(quota.baseD7)],
    [T('sharedUsed'), formatPercent(byKey.h5?.usedPercent), formatPercent(byKey.d7?.usedPercent)],
    [T('reset'), byKey.h5?.resetText || '-', byKey.d7?.resetText || '-']
  ];
  return `
    <div class="radar-table">
      <div class="radar-row radar-head"><span>${escapeHtml(T('tier'))}</span><strong>5h</strong><strong>7d</strong></div>
      ${rows.map(([label, five, week]) => `
        <div class="radar-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(five)}</strong><strong>${escapeHtml(week)}</strong></div>
      `).join('')}
    </div>
  `;
}

function selectView(view) {
  if (view !== 'usage' && view !== 'radar') return;
  const changed = activeView !== view;
  activeView = view;
  document.body.dataset.view = view;
  els.viewSwitch.dataset.view = view;
  els.viewButtons.forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  els.views.forEach((node) => node.classList.toggle('active', node.id === `${view}View`));
  if (changed) playMotionBurst();
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  toastTimer = window.setTimeout(() => els.toast.classList.remove('visible'), 2200);
}

function empty(message) {
  return `<div class="empty">${escapeHtml(message || T('noData'))}</div>`;
}

function formatUpdated(value) {
  if (!value) return '--';
  return T('updated', { time: formatClock(value) });
}

function formatRadarTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : formatUpdated(date.getTime());
}

function formatClock(value) {
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDateTime(value) {
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(lang, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDay(day) {
  const date = new Date(`${day}T00:00:00`);
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(date);
}

function formatTokens(value, withUnit = true) {
  const number = Number(value) || 0;
  const formatted = new Intl.NumberFormat(lang, {
    notation: number >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: number >= 10_000 ? 1 : 0
  }).format(number);
  return withUnit ? `${formatted} token` : formatted;
}

function formatUsd(value) {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD', maximumFractionDigits: number < 1 ? 2 : 1 }).format(number);
}

function formatHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return '--';
  return hours < 1 ? `${Math.max(1, Math.round(hours * 60))}m` : `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : '--';
}

function heatLevel(value, max) {
  if (!value) return 0;
  const ratio = value / Math.max(1, max);
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.55) return 4;
  if (ratio >= 0.32) return 3;
  if (ratio >= 0.14) return 2;
  return 1;
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyDay(date) {
  return { day: isoDate(date), tokens: 0, ioTokens: 0, threads: 0, costUsd: 0 };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

els.providerSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('.provider-button');
  if (!button || button.dataset.provider === provider) return;
  provider = button.dataset.provider;
  renderProviders(Object.keys(currentState.providers || {}));
  render();
  playMotionBurst();
});

els.viewButtons.forEach((button) => {
  button.addEventListener('click', () => selectView(button.dataset.view));
});

els.tokenCard.addEventListener('click', (event) => {
  const cell = event.target.closest('.heat-cell');
  if (!cell || !currentState) return;
  const activity = currentState.providers?.[provider]?.activity?.data;
  const day = normalizeDays(activity?.days || []).find((item) => item.day === cell.dataset.day);
  if (!day) return;
  els.tokenCard.querySelectorAll('.heat-cell').forEach((node) => node.classList.toggle('active', node === cell));
  const detail = document.getElementById('tokenDetail');
  if (detail) {
    detail.innerHTML = tokenDetailTemplate(day);
    detail.classList.remove('detail-pop');
    window.requestAnimationFrame(() => detail.classList.add('detail-pop'));
  }
});

els.refreshButton.addEventListener('click', async () => {
  els.refreshButton.classList.add('loading');
  playMotionBurst();
  showToast(T('refreshing'));
  try {
    await api('/api/refresh', { method: 'POST' });
  } catch (error) {
    showToast(error.message === 'unauthorized' ? T('unauthorized') : T('refreshFailed'));
  } finally {
    window.setTimeout(() => els.refreshButton.classList.remove('loading'), 500);
  }
});

async function start() {
  accessToken = readAccessToken();
  els.connectionLabel.textContent = T('connecting');
  selectView(activeView);
  try {
    if (accessToken) {
      await fetch('/api/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      });
    }
    applyState(await api('/api/state'));
    setConnection(true);
    connectEvents();
  } catch (error) {
    setConnection(false);
    els.quotaGrid.innerHTML = empty(error.message === 'unauthorized' ? T('unauthorized') : T('offline'));
    els.tokenCard.innerHTML = empty(error.message === 'unauthorized' ? T('unauthorized') : T('offline'));
    els.iqList.innerHTML = empty(error.message === 'unauthorized' ? T('unauthorized') : T('offline'));
    els.radarCard.innerHTML = empty(error.message === 'unauthorized' ? T('unauthorized') : T('offline'));
    if (error.message !== 'unauthorized') reconnectTimer = window.setTimeout(start, 5000);
  }
}

start();
