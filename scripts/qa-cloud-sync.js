const { app, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { createMobilePayload } = require('../src/mobile-server');
const {
  createCredentials,
  createPairingCode,
  deriveMaterial,
  encryptPayload
} = require('../src/mobile/cloud-sync-crypto');

const baseUrl = String(process.env.CMM_SYNC_QA_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const fixturePath = path.join(__dirname, '..', 'test', 'fixtures', 'qa-state.json');
const outputPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'mobile-cloud-qa.png'));

app.on('window-all-closed', () => {});

async function waitForReady(window) {
  await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 8000;
    const check = () => {
      if (document.body.classList.contains('ready')) return resolve();
      if (Date.now() > deadline) return reject(new Error(document.getElementById('pairingNote')?.textContent || 'cloud_mobile_timeout'));
      setTimeout(check, 50);
    };
    check();
  })`);
}

async function waitForPairingGate(window) {
  const result = await window.webContents.executeJavaScript(`new Promise((resolve) => {
    const deadline = Date.now() + 5000;
    const check = () => {
      if (document.body.classList.contains('unpaired')) return resolve({ ready: true });
      if (Date.now() > deadline) return resolve({
        ready: false,
        bodyClass: document.body.className,
        mode: window.CMM_MOBILE_MODE,
        gateHidden: document.getElementById('pairingGate')?.hidden,
        note: document.getElementById('pairingNote')?.textContent
      });
      setTimeout(check, 25);
    };
    check();
  })`);
  if (!result.ready) throw new Error(`cloud pairing gate timeout: ${JSON.stringify(result)}`);
}

app.whenReady().then(async () => {
  const credentials = createCredentials();
  const { authToken } = await deriveMaterial(credentials);
  const state = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const payload = createMobilePayload(state);
  payload.sync = { source: 'qa', generatedAt: Date.now() };
  const envelope = await encryptPayload(payload, credentials);
  const endpoint = `${baseUrl}/v1/snapshots/${credentials.accountId}`;
  const authorization = `Bearer ${authToken}`;

  const upload = await fetch(endpoint, {
    method: 'PUT',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope)
  });
  if (!upload.ok) throw new Error(`cloud QA upload failed: ${upload.status} ${await upload.text()}`);

  const window = new BrowserWindow({
    width: 390,
    height: 844,
    frame: false,
    show: false,
    webPreferences: {
      partition: `cmm-cloud-qa-${process.pid}`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    await window.loadURL(`${baseUrl}/mobile/`);
    await waitForPairingGate(window);
    const unpaired = await window.webContents.executeJavaScript(`({
      mode: window.CMM_MOBILE_MODE,
      visible: !document.getElementById('pairingGate').hidden,
      unpaired: document.body.classList.contains('unpaired')
    })`);
    if (unpaired.mode !== 'cloud' || !unpaired.visible || !unpaired.unpaired) {
      throw new Error(`cloud pairing gate failed: ${JSON.stringify(unpaired)}`);
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const pairingImage = await window.webContents.capturePage();
    const parsedOutput = path.parse(outputPath);
    await fs.writeFile(path.join(parsedOutput.dir, `${parsedOutput.name}-pairing${parsedOutput.ext}`), pairingImage.toPNG());

    const pairingCode = createPairingCode(credentials);
    await window.loadURL('about:blank');
    await window.loadURL(`${baseUrl}/mobile/#pair=${encodeURIComponent(pairingCode)}`);
    await waitForReady(window);
    await new Promise((resolve) => setTimeout(resolve, 720));

    const firstPass = await window.webContents.executeJavaScript(`({
      mode: window.CMM_MOBILE_MODE,
      fragmentCleared: !location.hash,
      paired: !document.body.classList.contains('unpaired'),
      providers: [...document.querySelectorAll('.provider-button')].map((node) => node.textContent.trim()),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      verticalOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1
    })`);
    if (firstPass.mode !== 'cloud' || !firstPass.fragmentCleared || !firstPass.paired) {
      throw new Error(`cloud pairing failed: ${JSON.stringify(firstPass)}`);
    }
    if (!firstPass.providers.includes('GPT') || firstPass.horizontalOverflow || firstPass.verticalOverflow) {
      throw new Error(`cloud mobile layout failed: ${JSON.stringify(firstPass)}`);
    }

    const image = await window.webContents.capturePage();
    await fs.writeFile(outputPath, image.toPNG());

    await window.loadURL(`${baseUrl}/mobile/`);
    await waitForReady(window);
    const reloadPass = await window.webContents.executeJavaScript(`({
      paired: !document.body.classList.contains('unpaired'),
      hasState: document.querySelectorAll('.provider-button').length > 0
    })`);
    if (!reloadPass.paired || !reloadPass.hasState) {
      throw new Error(`stored cloud pairing failed: ${JSON.stringify(reloadPass)}`);
    }
  } finally {
    window.destroy();
    await fetch(endpoint, { method: 'DELETE', headers: { Authorization: authorization } }).catch(() => {});
  }

  app.quit();
}).catch((error) => {
  const message = `${error?.stack || error}\n`;
  process.stderr.write(message);
  process.exitCode = 1;
  app.exit(1);
});
