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
  // 截图默认关掉所有动画，结果才稳定；CMM_QA_MOTION=1 保留动画，配合 CMM_QA_TOKEN_WAIT_MS 截动效中途的画面。
  const keepMotion = process.env.CMM_QA_MOTION === '1';
  if (!keepMotion) {
    await window.webContents.insertCSS(`
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `);
  }
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
  // CMM_QA_TOKEN_RANGE=week|month|quarter|year：截图前把 Token 活动切到对应范围（按钮点击，和用户操作一样）。
  const tokenRange = ['week', 'month', 'quarter', 'year'].includes(process.env.CMM_QA_TOKEN_RANGE) ? process.env.CMM_QA_TOKEN_RANGE : '';
  if (tokenRange && tab !== 'radar') {
    if (keepMotion) {
      // 本机记着上次的范围，目标范围可能已经选中；先切到另一边，保证这次点击是一次真的切换、会播入场动效。
      await window.webContents.executeJavaScript(`document.querySelector('[data-token-range="${tokenRange === 'month' ? 'week' : 'month'}"]')?.click()`);
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    await window.webContents.executeJavaScript(`document.querySelector('[data-token-range="${tokenRange}"]')?.click()`);
    // 1.1.1 起切换带入场动效（柱子依次长出来，最长约 0.65 秒），等它播完再截；
    // CMM_QA_TOKEN_WAIT_MS 可以改短，截动效播到一半的样子。
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.CMM_QA_TOKEN_WAIT_MS) || 900));
  }
  // CMM_QA_OPEN_QUOTA=1：截图前点额度标题行上的明细按钮，5 小时卡和一周卡一起展开。
  if (process.env.CMM_QA_OPEN_QUOTA === '1' && tab !== 'radar') {
    await window.webContents.executeJavaScript(`document.getElementById('quotaDetailsToggle')?.click()`);
    await new Promise((resolve) => setTimeout(resolve, 400));
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
  // CMM_QA_TOKEN_HOVER=0–12：柱状图视图（7 天 / 90 天 / 1 年）下把指针放到第几根柱子上，截悬停提示。
  const tokenHover = Number(process.env.CMM_QA_TOKEN_HOVER);
  if (tokenRange && tokenRange !== 'month' && process.env.CMM_QA_TOKEN_HOVER !== undefined && Number.isInteger(tokenHover)) {
    const point = await window.webContents.executeJavaScript(`(() => {
      const col = document.querySelectorAll('.token-week-col')[${tokenHover}];
      const rect = col?.querySelector('.token-week-track')?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.bottom - 8) } : null;
    })()`);
    if (point) {
      window.webContents.sendInputEvent({ type: 'mouseEnter', x: point.x, y: point.y });
      window.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  // CMM_QA_MOUSE='<CSS 选择器>'：把指针移到第一个匹配元素的中心（例如 .usage-head），核对悬停才显示的控件。
  if (process.env.CMM_QA_MOUSE) {
    const point = await window.webContents.executeJavaScript(`(() => {
      const rect = document.querySelector(${JSON.stringify(process.env.CMM_QA_MOUSE)})?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
    })()`);
    if (!point) throw new Error(`CMM_QA_MOUSE target not found: ${process.env.CMM_QA_MOUSE}`);
    window.webContents.sendInputEvent({ type: 'mouseEnter', x: point.x, y: point.y });
    window.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 24));
  // CMM_QA_MEASURE=1：截图前打印一行 JSON（窗口与内容高度、是否溢出出滚动条、两张额度卡的宽度），
  // 用来核对「展开明细后宽度会不会变」「GPT / Claude 是否等高」。
  if (process.env.CMM_QA_MEASURE === '1') {
    const measure = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.tab-panel.active');
      const round = (value) => Math.round(value * 10) / 10;
      const cards = [...document.querySelectorAll('#meters .quota-card')].map((card) => round(card.getBoundingClientRect().width));
      const tokenCard = document.querySelector('.tab-panel.active .token-card')?.getBoundingClientRect();
      const attribution = document.querySelector('#meters .quota-attribution')?.getBoundingClientRect();
      const range = document.getElementById('tokenRange')?.getBoundingClientRect();
      const head = document.querySelector('.token-head')?.getBoundingClientRect();
      return {
        innerHeight: window.innerHeight,
        panelClient: panel ? panel.clientHeight : null,
        panelScroll: panel ? panel.scrollHeight : null,
        scrollbar: panel ? panel.offsetWidth - panel.clientWidth : null,
        cards,
        tokenCard: tokenCard ? [round(tokenCard.width), round(tokenCard.height)] : null,
        attribution: attribution ? [round(attribution.width), round(attribution.height)] : null,
        tokenRange: range ? [round(range.width), round(range.height)] : null,
        tokenHead: head ? round(head.height) : null,
        bodyWidth: round(document.body.getBoundingClientRect().width)
      };
    })()`);
    console.log(`QA_MEASURE ${JSON.stringify({ provider: targetProvider, reportedHeight, ...measure })}`);
  }
  // CMM_QA_EVAL='<表达式>'：截图前在页面里求一个表达式的值，打印成一行 QA_EVAL <JSON>，排查样式问题用。
  if (process.env.CMM_QA_EVAL) {
    const value = await window.webContents.executeJavaScript(`(() => (${process.env.CMM_QA_EVAL}))()`);
    console.log(`QA_EVAL ${JSON.stringify(value)}`);
  }
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
