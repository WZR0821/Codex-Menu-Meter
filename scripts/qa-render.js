const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const [
  statePath,
  provider = 'codex',
  tab = 'usage',
  outputPath = '/tmp/codex-menu-meter-qa.png',
  motion = '',
  radarView = 'intelligence'
] = process.argv.slice(2);

if (!statePath) {
  console.error('usage: npm run qa:render -- <state.json> [provider] [usage|radar] [output.png] [opening|switch]');
  process.exit(2);
}

app.whenReady().then(async () => {
  // CMM_QA_APPEARANCE=dark|light：按指定外观截图（默认浅色，和应用默认一致）。
  nativeTheme.themeSource = process.env.CMM_QA_APPEARANCE === 'dark' ? 'dark' : 'light';
  let state = JSON.parse(await fs.readFile(path.resolve(statePath), 'utf8'));
  const historyNow = Date.now() - 5 * 60_000;
  for (const samples of [...Object.values(state.usageHistory || {}), ...Object.values(state.usageHistoryWeek || {})]) {
    if (!Array.isArray(samples) || !samples.length) continue;
    const latest = Math.max(...samples.map((sample) => Number(sample?.t) || 0));
    for (const sample of samples) sample.t = historyNow - (latest - Number(sample.t));
  }
  // CMM_QA_TREND=day|week：截图前展开额度曲线并切到对应范围。
  const trendRange = ['day', 'week'].includes(process.env.CMM_QA_TREND) ? process.env.CMM_QA_TREND : '';
  const knownProviders = ['codex', 'claude', 'kimi', 'glm', 'qwen'];
  const targetProvider = knownProviders.includes(provider) ? provider : 'codex';
  state.provider = motion === 'switch' && targetProvider !== 'codex' ? 'codex' : targetProvider;

  ipcMain.handle('state:get', () => state);
  ipcMain.handle('state:refresh', () => state);
  ipcMain.handle('provider:set', () => state);
  // 和主进程一样按渲染层量出的高度调整窗口，截图才是真实面板尺寸。
  let reportedHeight = 0;
  ipcMain.on('panel:content-height', (_event, height) => {
    const next = Math.round(Number(height));
    if (!Number.isFinite(next) || next <= 0) return;
    reportedHeight = Math.min(780, Math.max(300, next));
    if (window && !window.isDestroyed()) window.setSize(406, reportedHeight);
  });

  const window = new BrowserWindow({
    width: 406,
    height: 744,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await window.webContents.insertCSS(`
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
    }
  `);
  await window.webContents.executeJavaScript(`document.querySelector('[data-tab="${tab === 'radar' ? 'radar' : 'usage'}"]').click()`);
  if (tab === 'radar' && ['intelligence', 'quota', 'reset'].includes(radarView)) {
    await window.webContents.executeJavaScript(`document.querySelector('[data-radar-view="${radarView}"]').click()`);
  }
  await window.webContents.executeJavaScript(`new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })`);
  await new Promise((resolve) => setTimeout(resolve, 420));
  // 首次点击发生在 state:get 返回前时，renderer 还不知道目标 provider；再点一次确保按目标 provider 记住视图。
  if (tab === 'radar' && ['intelligence', 'quota', 'reset'].includes(radarView)) {
    await window.webContents.executeJavaScript(`document.querySelector('[data-radar-view="${radarView}"]')?.click()`);
    await window.webContents.executeJavaScript(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  }
  // CMM_QA_OPEN_MODEL=1：雷达智力页截图前展开第一张模型卡，用来核对详情里的指标。
  if (tab === 'radar' && radarView === 'intelligence' && process.env.CMM_QA_OPEN_MODEL === '1') {
    await window.webContents.executeJavaScript(`(() => {
      const detail = document.querySelector('#iqGrid details.model-detail');
      if (detail && !detail.open) detail.querySelector('summary').click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (trendRange && tab !== 'radar') {
    await window.webContents.executeJavaScript(`(() => {
      const detail = document.querySelector('details[data-detail="usage-trend"]');
      if (detail && !detail.open) detail.querySelector('summary').click();
      document.querySelector('[data-trend-range="${trendRange}"]')?.click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 360));
  }
  if (reportedHeight) window.setSize(406, reportedHeight);
  await new Promise((resolve) => setTimeout(resolve, 120));
  window.showInactive();
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (motion === 'opening') {
    window.webContents.send('panel:motion', 'opening');
    await new Promise((resolve) => setTimeout(resolve, 245));
  } else if (motion === 'switch') {
    state = { ...state, provider: targetProvider };
    window.webContents.send('state:update', state);
    await new Promise((resolve) => setTimeout(resolve, 235));
  } else {
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const hiddenHeadings = await window.webContents.executeJavaScript(`
    [...document.querySelectorAll('.tab-panel.active .section-head h2')]
      .filter((heading) => {
        const section = heading.closest('.section');
        if (section && getComputedStyle(section).display === 'none') return false; // 整块隐藏是有意行为（如附加平台无 Token 区）
        const style = getComputedStyle(heading);
        const bounds = heading.getBoundingClientRect();
        return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || bounds.width === 0;
      })
      .map((heading) => heading.textContent.trim())
  `);
  if (hiddenHeadings.length) {
    throw new Error(`hidden section headings: ${hiddenHeadings.join(', ')}`);
  }
  if (tab !== 'radar') {
    const overflow = await window.webContents.executeJavaScript(`(() => {
      const active = document.querySelector('.tab-panel.active');
      return { scroll: active.scrollHeight, client: active.clientHeight };
    })()`);
    if (overflow.scroll > overflow.client + 1) {
      throw new Error(`usage panel requires scrolling: ${JSON.stringify(overflow)}`);
    }
    const trend = await window.webContents.executeJavaScript(`(() => ({
      title: document.getElementById('trendTitle')?.textContent.trim(),
      legend: [...document.querySelectorAll('.trend-legend-item')].map((item) => item.textContent.trim()),
      xLabels: [...document.querySelectorAll('.trend-axis-x')].map((item) => item.textContent.trim()),
      yLabels: [...document.querySelectorAll('.trend-axis-y')].map((item) => item.textContent.trim()),
      yTitle: document.querySelector('.trend-axis-title')?.textContent.trim(),
      hasChart: Boolean(document.querySelector('.trend-card svg')),
      hasEmptyState: Boolean(document.querySelector('.trend-card-empty .trend-empty-state'))
    }))()`);
    if ((!trend.hasChart && !trend.hasEmptyState) || trend.title !== '额度曲线') {
      throw new Error(`quota curve missing: ${JSON.stringify(trend)}`);
    }
    // 图例：5 小时（GPT 暂无限额时是「∞」占位）、周额度、专项周限额（若有）、匀速参考线（有曲线时）。
    if (trend.legend.length < 2) {
      throw new Error(`quota curve axes/legend incomplete: ${JSON.stringify(trend)}`);
    }
    if (trend.hasChart && (trend.xLabels.length !== 3 || trend.yLabels.join(',') !== '100,50,0' || trend.yTitle !== '已用 %')) {
      throw new Error(`quota curve axes incomplete: ${JSON.stringify(trend)}`);
    }
    if (targetProvider === 'codex' && !trend.legend[0]?.includes('∞')) {
      throw new Error(`unlimited 5h placeholder missing: ${JSON.stringify(trend)}`);
    }
  }
  // CMM_QA_HOVER=0.0–1.0：把指针放到曲线横向的这个位置，截十字线提示。
  const hoverRatio = Number(process.env.CMM_QA_HOVER);
  if (trendRange && Number.isFinite(hoverRatio)) {
    const point = await window.webContents.executeJavaScript(`(() => {
      const rect = document.querySelector('.trend-card svg')?.getBoundingClientRect();
      if (!rect) return null;
      const left = rect.left + rect.width * (34 / 372);
      const right = rect.right - rect.width * (7 / 372);
      return { x: Math.round(left + (right - left) * ${hoverRatio}), y: Math.round(rect.top + rect.height * 0.5) };
    })()`);
    if (point) {
      window.webContents.sendInputEvent({ type: 'mouseEnter', x: point.x, y: point.y });
      window.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 24));
  const image = await window.webContents.capturePage();
  await fs.writeFile(path.resolve(outputPath), image.toPNG());
  if (motion) {
    await new Promise((resolve) => setTimeout(resolve, 1900));
    const leftovers = await window.webContents.executeJavaScript(`({
      sparks: document.querySelectorAll('.energy-spark, .provider-echo, .status-comet').length,
      running: document.getAnimations().filter((animation) => animation.playState === 'running').length
    })`);
    if (leftovers.sparks || leftovers.running) {
      throw new Error(`motion cleanup failed: ${JSON.stringify(leftovers)}`);
    }
  }
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
