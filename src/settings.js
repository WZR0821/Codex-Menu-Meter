const I18N = window.CMM_I18N;
const PROVIDERS = window.CMM_PROVIDERS;

const els = {
  language: document.getElementById('language'),
  openAtLogin: document.getElementById('openAtLogin'),
  autoHideWithMenuBar: document.getElementById('autoHideWithMenuBar'),
  autoSwitchProvider: document.getElementById('autoSwitchProvider'),
  notificationsEnabled: document.getElementById('notificationsEnabled'),
  alertThresholds: document.getElementById('alertThresholds'),
  paceAlertsEnabled: document.getElementById('paceAlertsEnabled'),
  creditExpiryAlerts: document.getElementById('creditExpiryAlerts'),
  weeklyResetReminder: document.getElementById('weeklyResetReminder'),
  updateCheckEnabled: document.getElementById('updateCheckEnabled'),
  updateStatus: document.getElementById('updateStatus'),
  updateAction: document.getElementById('updateAction'),
  priceAutoUpdate: document.getElementById('priceAutoUpdate'),
  priceStatus: document.getElementById('priceStatus'),
  copyDiagnostics: document.getElementById('copyDiagnostics'),
  webhookUrl: document.getElementById('webhookUrl'),
  webhookHint: document.getElementById('webhookHint'),
  testWebhook: document.getElementById('testWebhook'),
  appearance: document.getElementById('appearance'),
  mobileListenScope: document.getElementById('mobileListenScope'),
  hotkeyEnabled: document.getElementById('hotkeyEnabled'),
  mobileEnabled: document.getElementById('mobileEnabled'),
  mobileDetails: document.getElementById('mobileDetails'),
  mobileQr: document.getElementById('mobileQr'),
  mobileQrPlaceholder: document.getElementById('mobileQrPlaceholder'),
  mobileStatus: document.getElementById('mobileStatus'),
  mobileStatusHint: document.getElementById('mobileStatusHint'),
  mobileLink: document.getElementById('mobileLink'),
  openMobile: document.getElementById('openMobile'),
  copyMobileLink: document.getElementById('copyMobileLink'),
  rotateMobileToken: document.getElementById('rotateMobileToken'),
  tailscaleAction: document.getElementById('tailscaleAction'),
  tailscaleTitle: document.getElementById('tailscaleTitle'),
  tailscaleHint: document.getElementById('tailscaleHint'),
  tailscaleState: document.getElementById('tailscaleState'),
  cloudSyncEnabled: document.getElementById('cloudSyncEnabled'),
  cloudSyncServerUrl: document.getElementById('cloudSyncServerUrl'),
  cloudSyncDetails: document.getElementById('cloudSyncDetails'),
  cloudSyncQr: document.getElementById('cloudSyncQr'),
  cloudSyncQrPlaceholder: document.getElementById('cloudSyncQrPlaceholder'),
  cloudSyncStatus: document.getElementById('cloudSyncStatus'),
  cloudSyncStatusHint: document.getElementById('cloudSyncStatusHint'),
  openCloudSync: document.getElementById('openCloudSync'),
  copyCloudSyncLink: document.getElementById('copyCloudSyncLink'),
  copyCloudSyncRecovery: document.getElementById('copyCloudSyncRecovery'),
  pushCloudSync: document.getElementById('pushCloudSync'),
  resetCloudSync: document.getElementById('resetCloudSync'),
  saveState: document.getElementById('saveState'),
  appMeta: document.getElementById('appMeta'),
  refreshData: document.getElementById('refreshData'),
  openRadar: document.getElementById('openRadar'),
  showApp: document.getElementById('showApp'),
  quitApp: document.getElementById('quitApp'),
  scroll: document.querySelector('.settings-scroll'),
  i18n: [...document.querySelectorAll('[data-i18n]')]
};

const providerEls = Object.fromEntries(PROVIDERS.OPTIONAL_PROVIDER_IDS.map((id) => [id, {
  enabled: document.getElementById(`${id}Enabled`),
  key: document.getElementById(`${id}Key`),
  keyClear: document.getElementById(`${id}KeyClear`),
  keyRow: document.getElementById(`${id}KeyRow`)
}]));

let currentSettings = null;
let appVersion = '';
let scrollEdgeLock = null;
let mobileRenderToken = 0;
let cloudSyncRenderToken = 0;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function T(key, params) {
  return I18N.t(els.language.value, key, params);
}

els.language.addEventListener('change', () => updateSetting({ language: els.language.value }));
els.openAtLogin.addEventListener('change', () => updateSetting({ openAtLogin: els.openAtLogin.checked }));
els.autoHideWithMenuBar.addEventListener('change', () => updateSetting({ autoHideWithMenuBar: els.autoHideWithMenuBar.checked }));
els.autoSwitchProvider.addEventListener('change', () => updateSetting({ autoSwitchProvider: els.autoSwitchProvider.checked }));
els.notificationsEnabled.addEventListener('change', () => updateSetting({ notificationsEnabled: els.notificationsEnabled.checked }));
els.alertThresholds.addEventListener('change', () => updateSetting({ alertThresholds: els.alertThresholds.value }));
els.paceAlertsEnabled.addEventListener('change', () => updateSetting({ paceAlertsEnabled: els.paceAlertsEnabled.checked }));
els.creditExpiryAlerts.addEventListener('change', () => updateSetting({ creditExpiryAlerts: els.creditExpiryAlerts.checked }));
els.weeklyResetReminder.addEventListener('change', () => updateSetting({ weeklyResetReminder: els.weeklyResetReminder.checked }));
els.updateCheckEnabled.addEventListener('change', () => updateSetting({ updateCheckEnabled: els.updateCheckEnabled.checked }));
els.priceAutoUpdate.addEventListener('change', () => updateSetting({ priceAutoUpdate: els.priceAutoUpdate.checked }));
els.updateAction.addEventListener('click', handleUpdateAction);
els.copyDiagnostics.addEventListener('click', () => runAction('diagnosticsCopied', () => window.codexMeter.copyDiagnostics()));
els.webhookUrl.addEventListener('change', () => updateSetting({ webhookUrl: els.webhookUrl.value.trim() }));
els.testWebhook.addEventListener('click', testWebhook);
els.appearance.addEventListener('change', () => updateSetting({ appearance: els.appearance.value }));
els.mobileListenScope.addEventListener('change', () => updateSetting({ mobileListenScope: els.mobileListenScope.value }));
els.hotkeyEnabled.addEventListener('change', () => updateSetting({ hotkeyEnabled: els.hotkeyEnabled.checked }));
els.mobileEnabled.addEventListener('change', () => updateSetting({ mobileEnabled: els.mobileEnabled.checked }));
els.cloudSyncEnabled.addEventListener('change', handleCloudSyncToggle);
els.cloudSyncServerUrl.addEventListener('change', handleCloudSyncServerChange);
for (const id of PROVIDERS.OPTIONAL_PROVIDER_IDS) {
  const controls = providerEls[id];
  controls.enabled?.addEventListener('change', () => updateProvider(id, { enabled: controls.enabled.checked }));
  // 密钥单独走钥匙串：输入框不回显已存的密钥，留空表示不改，清除用旁边的按钮。
  controls.key?.addEventListener('change', () => {
    const value = controls.key.value.trim();
    if (value) saveProviderKey(id, value);
  });
  controls.keyClear?.addEventListener('click', () => saveProviderKey(id, ''));
}

async function saveProviderKey(id, value) {
  els.saveState.textContent = T('saving');
  const result = await window.codexMeter.setProviderKey(id, value);
  if (result?.settings) render(result.settings);
  const controls = providerEls[id];
  if (controls.key && result?.ok) controls.key.value = '';
  els.saveState.textContent = result?.ok ? T('synced') : (result?.error || T('errKeychainWrite'));
}

async function handleUpdateAction() {
  if (currentSettings?.update?.available) {
    await window.codexMeter.openUpdate();
    return;
  }
  els.updateAction.disabled = true;
  try {
    currentSettings = await window.codexMeter.checkUpdate();
    render(currentSettings);
  } finally {
    els.updateAction.disabled = false;
  }
}

function renderUpdates(settings) {
  const update = settings.update || {};
  let status;
  if (update.status === 'checking') status = T('updateChecking');
  else if (update.available) status = T('updateAvailable', { version: update.latest.version, current: update.current });
  else if (update.status === 'error' && update.error) status = T('updateFailed', { error: update.error });
  else if (update.latest && update.enabled) status = T('updateCurrent', { version: update.current });
  else status = T('updateUnknown', { version: update.current || appVersion });
  els.updateStatus.textContent = status;
  els.updateAction.textContent = update.available ? T('updateOpen') : T('updateCheckNow');
  els.updateAction.disabled = update.status === 'checking';

  const prices = settings.priceTable || {};
  let priceText = prices.source === 'litellm'
    ? T('priceSourceLitellm', { date: prices.asOf, count: prices.models })
    : T('priceSourceBuiltin', { date: prices.asOf || '--' });
  if (prices.enabled && prices.error) priceText += ` · ${T('priceSourceError', { error: prices.error })}`;
  els.priceStatus.textContent = priceText;
}

function updateProvider(id, patch) {
  const current = currentSettings?.providerSettings || {};
  updateSetting({
    providerSettings: {
      ...current,
      [id]: { ...current[id], ...patch }
    }
  });
}
els.refreshData.addEventListener('click', refreshData);
els.openRadar.addEventListener('click', () => runAction('opened', () => window.codexMeter.openRadar()));
els.showApp.addEventListener('click', () => runAction('opened', () => window.codexMeter.showAppInFolder()));
els.quitApp.addEventListener('click', () => window.codexMeter.quitApp());
els.openMobile.addEventListener('click', () => runAction('opened', () => window.codexMeter.openMobile()));
els.copyMobileLink.addEventListener('click', () => runAction('mobileCopied', () => window.codexMeter.copyMobileLink()));
els.rotateMobileToken.addEventListener('click', rotateMobileToken);
els.tailscaleAction.addEventListener('click', handleTailscaleAction);
els.openCloudSync.addEventListener('click', () => runCloudSyncAction('opened', () => window.codexMeter.openCloudSync()));
els.copyCloudSyncLink.addEventListener('click', () => runCloudSyncAction('cloudSyncCopied', () => window.codexMeter.copyCloudSyncLink()));
els.copyCloudSyncRecovery.addEventListener('click', () => runCloudSyncAction('cloudSyncCopied', () => window.codexMeter.copyCloudSyncRecovery()));
els.pushCloudSync.addEventListener('click', () => runCloudSyncAction('synced', async () => {
  currentSettings = await window.codexMeter.pushCloudSync();
  render(currentSettings);
}));
els.resetCloudSync.addEventListener('click', resetCloudSyncPairing);
els.scroll.addEventListener('wheel', handleSettingsWheel, { passive: true });

window.codexMeter.onSettings(render);
window.codexMeter.getSettings().then(render);
window.codexMeter.getVersion().then((version) => {
  appVersion = version || '';
  applyLanguage(els.language.value);
});

function render(settings) {
  currentSettings = settings;
  els.language.value = I18N.normalizeLanguage(settings.language);
  els.openAtLogin.checked = Boolean(settings.openAtLogin);
  els.autoHideWithMenuBar.checked = Boolean(settings.autoHideWithMenuBar);
  els.autoSwitchProvider.checked = Boolean(settings.autoSwitchProvider);
  els.notificationsEnabled.checked = Boolean(settings.notificationsEnabled);
  els.alertThresholds.value = settings.alertThresholds || '20,5';
  els.paceAlertsEnabled.checked = settings.paceAlertsEnabled !== false;
  els.creditExpiryAlerts.checked = settings.creditExpiryAlerts !== false;
  els.weeklyResetReminder.checked = settings.weeklyResetReminder !== false;
  els.updateCheckEnabled.checked = settings.updateCheckEnabled !== false;
  els.priceAutoUpdate.checked = settings.priceAutoUpdate !== false;
  if (document.activeElement !== els.webhookUrl) els.webhookUrl.value = settings.webhookUrl || '';
  els.appearance.value = settings.appearance || 'light';
  els.mobileListenScope.value = settings.mobileListenScope || 'lan';
  els.hotkeyEnabled.checked = Boolean(settings.hotkeyEnabled);
  els.mobileEnabled.checked = Boolean(settings.mobileEnabled);
  els.cloudSyncEnabled.checked = Boolean(settings.cloudSyncEnabled);
  if (document.activeElement !== els.cloudSyncServerUrl) {
    els.cloudSyncServerUrl.value = settings.cloudSyncServerUrl || '';
  }
  const providerSettings = settings.providerSettings || {};
  for (const id of PROVIDERS.OPTIONAL_PROVIDER_IDS) {
    const controls = providerEls[id];
    if (!controls.enabled) continue;
    controls.enabled.checked = Boolean(providerSettings[id]?.enabled);
    const stored = Boolean(providerSettings[id]?.apiKeyStored);
    if (controls.key) {
      if (document.activeElement !== controls.key) controls.key.value = '';
      controls.key.dataset.stored = stored ? 'true' : 'false';
    }
    if (controls.keyClear) controls.keyClear.hidden = !stored;
    if (controls.keyRow) controls.keyRow.hidden = !controls.enabled.checked;
  }
  applyLanguage(els.language.value);
  renderMobile(settings);
  renderCloudSync(settings);
}

async function handleCloudSyncToggle() {
  const enabled = els.cloudSyncEnabled.checked;
  if (enabled && !els.cloudSyncServerUrl.value.trim()) {
    els.cloudSyncEnabled.checked = false;
    els.saveState.textContent = T('cloudSyncUnconfigured');
    return;
  }
  els.saveState.textContent = T('saving');
  try {
    currentSettings = await window.codexMeter.configureCloudSync({
      enabled,
      serverUrl: els.cloudSyncServerUrl.value.trim()
    });
    render(currentSettings);
    els.saveState.textContent = T('synced');
  } catch (error) {
    els.cloudSyncEnabled.checked = Boolean(currentSettings?.cloudSyncEnabled);
    els.saveState.textContent = error.message || T('cloudSyncError');
  }
}

async function handleCloudSyncServerChange() {
  const serverUrl = els.cloudSyncServerUrl.value.trim();
  if (!currentSettings?.cloudSyncEnabled) {
    await updateSetting({ cloudSyncServerUrl: serverUrl });
    return;
  }
  els.saveState.textContent = T('saving');
  try {
    currentSettings = await window.codexMeter.configureCloudSync({ enabled: true, serverUrl });
    render(currentSettings);
    els.saveState.textContent = T('synced');
  } catch (error) {
    els.saveState.textContent = error.message || T('cloudSyncError');
  }
}

async function runCloudSyncAction(statusKey, action) {
  els.saveState.textContent = T('refreshing');
  try {
    await action();
    els.saveState.textContent = T(statusKey);
  } catch (error) {
    els.saveState.textContent = error.message || T('cloudSyncError');
  }
  window.setTimeout(() => {
    els.saveState.textContent = T('synced');
  }, 1600);
}

async function resetCloudSyncPairing() {
  if (!window.confirm(T('cloudSyncResetConfirm'))) return;
  await runCloudSyncAction('synced', async () => {
    currentSettings = await window.codexMeter.resetCloudSync();
    render(currentSettings);
  });
}

async function updateSetting(patch) {
  els.saveState.textContent = T('saving');
  currentSettings = await window.codexMeter.updateSettings({ ...currentSettings, ...patch });
  render(currentSettings);
  els.saveState.textContent = T('synced');
}

async function testWebhook() {
  const url = els.webhookUrl.value.trim();
  if (!url) {
    els.saveState.textContent = T('webhookInvalid');
    return;
  }
  els.testWebhook.disabled = true;
  els.saveState.textContent = T('refreshing');
  try {
    if (url !== (currentSettings?.webhookUrl || '')) await updateSetting({ webhookUrl: url });
    const result = await window.codexMeter.testWebhook(url);
    els.saveState.textContent = result?.ok ? T('webhookSent') : (result?.error || T('webhookFailed'));
  } catch (error) {
    els.saveState.textContent = error?.message || T('webhookFailed');
  } finally {
    els.testWebhook.disabled = false;
    window.setTimeout(() => {
      els.saveState.textContent = T('synced');
    }, 2400);
  }
}

async function refreshData() {
  els.saveState.textContent = T('refreshing');
  await window.codexMeter.refresh();
  els.saveState.textContent = T('refreshed');
  window.setTimeout(() => {
    els.saveState.textContent = T('synced');
  }, 1200);
}

async function runAction(statusKey, action) {
  await action();
  els.saveState.textContent = T(statusKey);
  window.setTimeout(() => {
    els.saveState.textContent = T('synced');
  }, 1200);
}

async function rotateMobileToken() {
  els.saveState.textContent = T('saving');
  currentSettings = await window.codexMeter.rotateMobileToken();
  render(currentSettings);
  els.saveState.textContent = T('mobileKeyRotated');
  window.setTimeout(() => {
    els.saveState.textContent = T('synced');
  }, 1400);
}

async function handleTailscaleAction() {
  const runtime = currentSettings?.mobileRuntime || {};
  els.saveState.textContent = T('refreshing');
  if (!runtime.tailscaleInstalled) {
    await window.codexMeter.installTailscale();
    els.saveState.textContent = T('opened');
    return;
  }
  if (runtime.tailscaleState === 'ready') {
    currentSettings = await window.codexMeter.refreshTailscaleStatus();
  } else {
    const result = await window.codexMeter.configureTailscale();
    if (result?.settings) currentSettings = result.settings;
    else currentSettings = await window.codexMeter.refreshTailscaleStatus();
  }
  render(currentSettings);
  els.saveState.textContent = T('synced');
}

async function renderMobile(settings) {
  const token = ++mobileRenderToken;
  const enabled = Boolean(settings.mobileEnabled);
  const runtime = settings.mobileRuntime || {};
  els.mobileDetails.hidden = !enabled;
  if (!enabled) return;

  const remoteReady = runtime.tailscaleState === 'ready' && runtime.remoteAccessUrl;
  const lanReady = !remoteReady && Boolean(runtime.lanAccessUrl);
  els.mobileStatus.textContent = runtime.error
    ? T('mobileError')
    : runtime.running
      ? T(remoteReady ? 'mobileRemoteReady' : lanReady ? 'mobileLanReady' : 'mobileLocalReady')
      : T('mobileStopped');
  els.mobileStatusHint.textContent = runtime.error
    || T(remoteReady ? 'mobileRemoteHint' : lanReady ? 'mobileLanHint' : 'mobileLocalHint');
  els.mobileLink.value = runtime.preferredAccessUrl || '';
  els.openMobile.disabled = !runtime.preferredAccessUrl;
  els.copyMobileLink.disabled = !runtime.preferredAccessUrl;

  applyTailscaleState(runtime);
  const dataUrl = await window.codexMeter.getMobileQr();
  if (token !== mobileRenderToken) return;
  if (dataUrl) {
    els.mobileQr.src = dataUrl;
    els.mobileQr.hidden = false;
    els.mobileQrPlaceholder.hidden = true;
  } else {
    els.mobileQr.removeAttribute('src');
    els.mobileQr.hidden = true;
    els.mobileQrPlaceholder.hidden = false;
  }
}

async function renderCloudSync(settings) {
  const token = ++cloudSyncRenderToken;
  const enabled = Boolean(settings.cloudSyncEnabled);
  const runtime = settings.cloudSyncRuntime || {};
  els.cloudSyncDetails.hidden = !enabled;
  if (!enabled) return;

  const statusKeys = {
    syncing: 'cloudSyncSyncing',
    ready: 'cloudSyncReady',
    error: 'cloudSyncError',
    disabled: 'cloudSyncDisabled'
  };
  els.cloudSyncStatus.textContent = T(statusKeys[runtime.status] || 'cloudSyncNever');
  els.cloudSyncStatusHint.textContent = runtime.error
    || (runtime.lastSyncedAt
      ? T('cloudSyncLast', { time: formatSettingsDateTime(runtime.lastSyncedAt) })
      : T('cloudSyncNever'));
  const configured = Boolean(runtime.configured);
  for (const button of [els.openCloudSync, els.copyCloudSyncLink, els.copyCloudSyncRecovery, els.pushCloudSync, els.resetCloudSync]) {
    button.disabled = !configured || runtime.status === 'syncing';
  }

  const dataUrl = await window.codexMeter.getCloudSyncQr();
  if (token !== cloudSyncRenderToken) return;
  if (dataUrl) {
    els.cloudSyncQr.src = dataUrl;
    els.cloudSyncQr.hidden = false;
    els.cloudSyncQrPlaceholder.hidden = true;
  } else {
    els.cloudSyncQr.removeAttribute('src');
    els.cloudSyncQr.hidden = true;
    els.cloudSyncQrPlaceholder.hidden = false;
  }
}

function formatSettingsDateTime(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(els.language.value, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function applyTailscaleState(runtime) {
  const state = runtime.tailscaleState || 'not-installed';
  const ready = state === 'ready';
  els.tailscaleAction.classList.toggle('ready', ready);
  if (!runtime.tailscaleInstalled) {
    els.tailscaleTitle.textContent = T('tailscaleInstall');
    els.tailscaleHint.textContent = T('tailscaleInstallHint');
    els.tailscaleState.textContent = T('tailscaleNotInstalled');
    return;
  }

  els.tailscaleTitle.textContent = ready ? T('mobileRemoteReady') : T('tailscaleConfigure');
  els.tailscaleHint.textContent = ready ? T('mobileRemoteHint') : T('tailscaleConfigureHint');
  const labels = {
    ready: 'tailscaleReady',
    disconnected: 'tailscaleDisconnected',
    'needs-consent': 'tailscaleConsent',
    'not-configured': 'tailscaleNotConfigured',
    error: 'tailscaleError'
  };
  els.tailscaleState.textContent = T(labels[state] || 'tailscaleNotConfigured');
}

function applyLanguage(language) {
  document.documentElement.lang = I18N.normalizeLanguage(language);
  els.i18n.forEach((node) => {
    node.textContent = T(node.dataset.i18n);
  });
  if (els.appMeta) {
    els.appMeta.textContent = appVersion ? `${T('subtitle')} · v${appVersion}` : T('subtitle');
  }
  for (const id of PROVIDERS.OPTIONAL_PROVIDER_IDS) {
    const key = providerEls[id]?.key;
    if (key) key.placeholder = key.dataset.stored === 'true' ? T('apiKeyStoredPlaceholder') : key.dataset.emptyPlaceholder || '';
  }
  if (currentSettings) renderUpdates(currentSettings);
  els.saveState.textContent = T('synced');
}

function handleSettingsWheel(event) {
  if (!els.scroll || els.scroll.scrollHeight <= els.scroll.clientHeight + 2) return;
  const atBottom = els.scroll.scrollTop + els.scroll.clientHeight >= els.scroll.scrollHeight - 2;
  const atTop = els.scroll.scrollTop <= 0;

  if (scrollEdgeLock === 'bottom' && (!atBottom || event.deltaY < 0)) scrollEdgeLock = null;
  if (scrollEdgeLock === 'top' && (!atTop || event.deltaY > 0)) scrollEdgeLock = null;

  if (event.deltaY > 0 && atBottom) triggerScrollEdge('bottom');
  if (event.deltaY < 0 && atTop) triggerScrollEdge('top');
}

function triggerScrollEdge(edge) {
  if (!els.scroll || scrollEdgeLock === edge) return;
  scrollEdgeLock = edge;
  if (reduceMotion.matches) return;
  const offset = edge === 'top' ? 2 : -2;
  els.scroll.animate([
    { transform: 'translateY(0)' },
    { transform: `translateY(${offset}px)`, offset: 0.42 },
    { transform: 'translateY(0)' }
  ], { duration: 260, easing: 'ease-out' });
}
