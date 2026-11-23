const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const qrcode = require('qrcode-generator');

const outputPath = path.resolve(process.argv[2] || '/tmp/codex-menu-meter-settings-qa.png');
let settings = {
  language: 'zh-CN',
  openAtLogin: true,
  autoHideWithMenuBar: true,
  autoSwitchProvider: true,
  notificationsEnabled: true,
  hotkeyEnabled: true,
  mobileEnabled: true,
  mobileAccessToken: 'qa-mobile-token-20260723',
  cloudSyncEnabled: true,
  cloudSyncServerUrl: 'https://codex-meter-sync.example.workers.dev',
  cloudSyncAccountId: 'qaCloudSyncAccount123456',
  cloudSyncRuntime: {
    status: 'ready',
    configured: true,
    serverUrl: 'https://codex-meter-sync.example.workers.dev',
    accountId: 'qaCloudSyncAccount123456',
    lastSyncedAt: 1785300000000,
    lastAttemptAt: 1785300000000,
    error: null
  },
  mobileRuntime: {
    running: true,
    localBaseUrl: 'http://127.0.0.1:43821',
    lanBaseUrl: 'http://192.168.0.23:43821',
    remoteBaseUrl: null,
    tailscaleInstalled: false,
    tailscaleState: 'not-installed',
    error: null,
    localAccessUrl: 'http://127.0.0.1:43821/mobile/?token=qa-mobile-token-20260723',
    lanAccessUrl: 'http://192.168.0.23:43821/mobile/?token=qa-mobile-token-20260723',
    remoteAccessUrl: null,
    preferredAccessUrl: 'http://192.168.0.23:43821/mobile/?token=qa-mobile-token-20260723'
  },
  provider: 'codex',
  providerSettings: {
    claude: { enabled: true, apiKeyStored: false },
    kimi: { enabled: true, apiKeyStored: true },
    glm: { enabled: true, apiKeyStored: false },
    qwen: { enabled: true, apiKeyStored: false }
  },
  paceAlertsEnabled: true,
  creditExpiryAlerts: true,
  weeklyResetReminder: true,
  updateCheckEnabled: true,
  priceAutoUpdate: true,
  // CMM_QA_UPDATE=available：模拟 GitHub 上有更新的版本。
  priceTable: { enabled: true, source: 'litellm', asOf: '2026-11-23', models: 135, checkedAt: 1795400000000, error: null },
  update: process.env.CMM_QA_UPDATE === 'available'
    ? { enabled: true, current: require('../package.json').version, status: 'ready', error: null, checkedAt: 1795400000000, latest: { version: '9.9.9', url: 'https://github.com/WZR0821/Codex-Menu-Meter/releases/latest' }, available: true }
    : { enabled: true, current: require('../package.json').version, status: 'ready', error: null, checkedAt: 1795400000000, latest: { version: require('../package.json').version, url: 'https://github.com/WZR0821/Codex-Menu-Meter/releases/latest' }, available: false }
};

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  // CMM_QA_APPEARANCE=dark|light：按指定外观截图（默认浅色，和应用默认一致）。
  nativeTheme.themeSource = process.env.CMM_QA_APPEARANCE === 'dark' ? 'dark' : 'light';
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:update', (_event, next) => {
    settings = { ...settings, ...next };
    return settings;
  });
  ipcMain.handle('app:version', () => require('../package.json').version);
  ipcMain.handle('state:refresh', () => ({}));
  ipcMain.handle('mobile:get-qr', () => {
    const qr = qrcode(0, 'M');
    qr.addData(settings.mobileRuntime.preferredAccessUrl);
    qr.make();
    return qr.createDataURL(5, 4);
  });
  ipcMain.handle('mobile:open', () => true);
  ipcMain.handle('mobile:copy-link', () => true);
  ipcMain.handle('mobile:rotate-token', () => settings);
  ipcMain.handle('mobile:tailscale-status', () => settings);
  ipcMain.handle('mobile:tailscale-configure', () => ({ ok: false }));
  ipcMain.handle('mobile:tailscale-install', () => true);
  ipcMain.handle('cloud-sync:configure', () => settings);
  ipcMain.handle('cloud-sync:push', () => settings);
  ipcMain.handle('cloud-sync:get-qr', () => {
    const qr = qrcode(0, 'M');
    qr.addData('https://codex-meter-sync.example.workers.dev/mobile/#pair=qa-encrypted-pairing-code');
    qr.make();
    return qr.createDataURL(5, 4);
  });
  ipcMain.handle('cloud-sync:copy-link', () => true);
  ipcMain.handle('cloud-sync:copy-recovery', () => true);
  ipcMain.handle('cloud-sync:open', () => true);
  ipcMain.handle('cloud-sync:reset', () => settings);
  ipcMain.handle('provider:set-key', () => ({ ok: true, settings }));
  ipcMain.handle('update:check', () => settings);
  ipcMain.handle('update:open', () => true);
  ipcMain.handle('diagnostics:copy', () => true);

  const window = new BrowserWindow({
    width: 390,
    height: 520,
    show: false,
    frame: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await window.loadFile(path.join(__dirname, '..', 'src', 'settings.html'));
  await window.webContents.executeJavaScript(`new Promise((resolve) => {
    document.querySelector('[data-i18n="mobileSection"]').scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })`);
  const overflow = await window.webContents.executeJavaScript(`({
    page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    rows: [...document.querySelectorAll('.setting-row')]
      .filter((row) => row.scrollWidth > row.clientWidth + 1)
      .map((row) => row.getAttribute('for')),
    mobile: document.querySelector('.mobile-details').scrollWidth
      > document.querySelector('.mobile-details').clientWidth + 1,
    cloud: document.querySelector('.cloud-sync-section').scrollWidth
      > document.querySelector('.cloud-sync-section').clientWidth + 1
  })`);
  if (overflow.page || overflow.rows.length || overflow.mobile || overflow.cloud) {
    throw new Error(`settings overflow: ${JSON.stringify(overflow)}`);
  }

  window.showInactive();
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const image = await window.webContents.capturePage();
  await fs.writeFile(outputPath, image.toPNG());
  await window.webContents.executeJavaScript(`new Promise((resolve) => {
    document.querySelector('.cloud-sync-section').scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })`);
  const cloudImage = await window.webContents.capturePage();
  const parsedOutput = path.parse(outputPath);
  await fs.writeFile(path.join(parsedOutput.dir, `${parsedOutput.name}-cloud${parsedOutput.ext}`), cloudImage.toPNG());
  // 顶部（外观、菜单栏样式、提醒）也截一张。
  await window.webContents.executeJavaScript(`new Promise((resolve) => {
    document.querySelector('.settings-scroll')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })`);
  const topImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(parsedOutput.dir, `${parsedOutput.name}-top${parsedOutput.ext}`), topImage.toPNG());
  for (const [selector, suffix] of [['.alerts-section', 'alerts'], ['.update-section', 'updates'], ['#kimiKeyRow', 'keys']]) {
    await window.webContents.executeJavaScript(`new Promise((resolve) => {
      document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'start' });
      document.querySelector('.settings-scroll')?.scrollBy(0, -30);
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    })`);
    const sectionImage = await window.webContents.capturePage();
    await fs.writeFile(path.join(parsedOutput.dir, `${parsedOutput.name}-${suffix}${parsedOutput.ext}`), sectionImage.toPNG());
  }
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
