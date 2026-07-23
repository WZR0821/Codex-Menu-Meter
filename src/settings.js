const I18N = window.CMM_I18N;
const PROVIDERS = window.CMM_PROVIDERS;

const els = {
  language: document.getElementById('language'),
  openAtLogin: document.getElementById('openAtLogin'),
  autoHideWithMenuBar: document.getElementById('autoHideWithMenuBar'),
  notificationsEnabled: document.getElementById('notificationsEnabled'),
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
  keyRow: document.getElementById(`${id}KeyRow`)
}]));

let currentSettings = null;
let appVersion = '';
let scrollEdgeLock = null;
let mobileRenderToken = 0;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function T(key, params) {
  return I18N.t(els.language.value, key, params);
}

els.language.addEventListener('change', () => updateSetting({ language: els.language.value }));
els.openAtLogin.addEventListener('change', () => updateSetting({ openAtLogin: els.openAtLogin.checked }));
els.autoHideWithMenuBar.addEventListener('change', () => updateSetting({ autoHideWithMenuBar: els.autoHideWithMenuBar.checked }));
els.notificationsEnabled.addEventListener('change', () => updateSetting({ notificationsEnabled: els.notificationsEnabled.checked }));
els.hotkeyEnabled.addEventListener('change', () => updateSetting({ hotkeyEnabled: els.hotkeyEnabled.checked }));
els.mobileEnabled.addEventListener('change', () => updateSetting({ mobileEnabled: els.mobileEnabled.checked }));
for (const id of PROVIDERS.OPTIONAL_PROVIDER_IDS) {
  const controls = providerEls[id];
  controls.enabled?.addEventListener('change', () => updateProvider(id, { enabled: controls.enabled.checked }));
  controls.key?.addEventListener('change', () => updateProvider(id, { apiKey: controls.key.value.trim() }));
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
  els.notificationsEnabled.checked = Boolean(settings.notificationsEnabled);
  els.hotkeyEnabled.checked = Boolean(settings.hotkeyEnabled);
  els.mobileEnabled.checked = Boolean(settings.mobileEnabled);
  const providerSettings = settings.providerSettings || {};
  for (const id of PROVIDERS.OPTIONAL_PROVIDER_IDS) {
    const controls = providerEls[id];
    if (!controls.enabled) continue;
    controls.enabled.checked = Boolean(providerSettings[id]?.enabled);
    if (controls.key) controls.key.value = providerSettings[id]?.apiKey || '';
    if (controls.keyRow) controls.keyRow.hidden = !controls.enabled.checked;
  }
  applyLanguage(els.language.value);
  renderMobile(settings);
}

async function updateSetting(patch) {
  els.saveState.textContent = T('saving');
  currentSettings = await window.codexMeter.updateSettings({ ...currentSettings, ...patch });
  render(currentSettings);
  els.saveState.textContent = T('synced');
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
