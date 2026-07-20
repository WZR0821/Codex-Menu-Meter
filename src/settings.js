const I18N = window.CMM_I18N;
const PROVIDERS = window.CMM_PROVIDERS;

const els = {
  language: document.getElementById('language'),
  openAtLogin: document.getElementById('openAtLogin'),
  autoHideWithMenuBar: document.getElementById('autoHideWithMenuBar'),
  notificationsEnabled: document.getElementById('notificationsEnabled'),
  hotkeyEnabled: document.getElementById('hotkeyEnabled'),
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
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function T(key, params) {
  return I18N.t(els.language.value, key, params);
}

els.language.addEventListener('change', () => updateSetting({ language: els.language.value }));
els.openAtLogin.addEventListener('change', () => updateSetting({ openAtLogin: els.openAtLogin.checked }));
els.autoHideWithMenuBar.addEventListener('change', () => updateSetting({ autoHideWithMenuBar: els.autoHideWithMenuBar.checked }));
els.notificationsEnabled.addEventListener('change', () => updateSetting({ notificationsEnabled: els.notificationsEnabled.checked }));
els.hotkeyEnabled.addEventListener('change', () => updateSetting({ hotkeyEnabled: els.hotkeyEnabled.checked }));
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
  const providerSettings = settings.providerSettings || {};
  for (const id of PROVIDERS.OPTIONAL_PROVIDER_IDS) {
    const controls = providerEls[id];
    if (!controls.enabled) continue;
    controls.enabled.checked = Boolean(providerSettings[id]?.enabled);
    if (controls.key) controls.key.value = providerSettings[id]?.apiKey || '';
    if (controls.keyRow) controls.keyRow.hidden = !controls.enabled.checked;
  }
  applyLanguage(els.language.value);
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
