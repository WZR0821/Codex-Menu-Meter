const { app, BrowserWindow, nativeTheme } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { createMobileServer } = require('../src/mobile-server');

const statePath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'test', 'fixtures', 'qa-state.json'));
const outputDir = path.resolve(process.argv[3] || path.join(__dirname, '..', 'dist'));
const token = 'qa-mobile-token';

app.whenReady().then(async () => {
  // CMM_QA_APPEARANCE=dark|light：按指定外观截图（手机页跟随系统，这里用它模拟手机的深色）。
  nativeTheme.themeSource = process.env.CMM_QA_APPEARANCE === 'dark' ? 'dark' : 'light';
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  if (state.radar?.data?.modelIq?.items?.[0]) {
    state.radar.data.modelIq.items[0].modelLabel = 'GPT-5.6-Sol-Codex Extended';
  }
  // Claude 的专项周限额（Fable）：1.1.0 起并进「一周」卡，截图要能看到它，单屏检查也要带上它。
  const claudeUsage = state.claudeUsage?.data;
  if (claudeUsage && !claudeUsage.extraWindows?.length) {
    claudeUsage.planType = claudeUsage.planType || 'Max 5x';
    claudeUsage.extraWindows = [{
      name: 'Fable',
      remainingPercent: 87,
      usedPercent: 13,
      resetAt: Date.now() + 6 * 86_400_000 + 23 * 3_600_000 + 40 * 60_000
    }];
  }
  const server = createMobileServer({
    assetsDir: path.join(__dirname, '..', 'src', 'mobile'),
    getAccessToken: () => token,
    getState: () => state,
    onRefresh: () => {},
    host: '127.0.0.1',
    port: 0
  });
  const address = await server.start();
  const window = new BrowserWindow({
    width: 390,
    height: 844,
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await window.loadURL(`http://127.0.0.1:${address.port}/mobile/?token=${token}`);
  await window.webContents.executeJavaScript(`new Promise((resolve) => {
    const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
    document.body.classList.contains('ready')
      ? done()
      : new MutationObserver((records, observer) => {
          if (!document.body.classList.contains('ready')) return;
          observer.disconnect();
          done();
        }).observe(document.body, { attributes: true });
  })`);
  await new Promise((resolve) => setTimeout(resolve, 760));
  await fs.mkdir(outputDir, { recursive: true });

  const capture = async (name, { singleScreen = false } = {}) => {
    const overflow = await window.webContents.executeJavaScript(`({
      page: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      nodes: [...document.querySelectorAll('body *')].filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
      }).map((node) => node.className || node.tagName).slice(0, 12)
    })`);
    if (overflow.page || overflow.nodes.length) {
      throw new Error(`mobile overflow: ${JSON.stringify(overflow)}`);
    }
    if (singleScreen) {
      const vertical = await window.webContents.executeJavaScript(`(() => {
        const view = document.getElementById('usageView');
        const token = document.getElementById('tokenCard');
        const pace = document.getElementById('paceCard');
        // 曲线卡放得下才出现；出现时也不能被裁掉。
        const last = pace && !pace.hidden ? pace : token;
        const bounds = last.getBoundingClientRect();
        // 曲线卡被收起时，记下放进来会多出多少（便于调版式）。
        let missing = 0;
        if (pace && pace.hidden && pace.dataset.ready) {
          pace.hidden = false;
          missing = Math.max(0, document.documentElement.scrollHeight - innerHeight);
          pace.hidden = true;
        }
        return {
          missing,
          viewport: innerHeight,
          pageScroll: document.documentElement.scrollHeight > innerHeight + 1,
          viewOverflow: view.scrollHeight > view.clientHeight + 1,
          paceCard: pace ? (pace.hidden ? 'hidden' : 'shown') : 'missing',
          bottom: Math.round(bounds.bottom),
          clipped: bounds.bottom > innerHeight + 1
        };
      })()`);
      if (vertical.pageScroll || vertical.viewOverflow || vertical.clipped) {
        throw new Error(`mobile usage requires vertical scroll: ${JSON.stringify(vertical)}`);
      }
      console.log(`${name}: ${JSON.stringify(vertical)}`);
    }
    const image = await window.webContents.capturePage();
    await fs.writeFile(path.join(outputDir, `mobile-${name}-qa.png`), image.toPNG());
  };

  await capture('usage', { singleScreen: true });
  // 1.1.0：Token 活动切到 7 天直方图，也要一屏放完；点一根柱子看详情跟着换，再切回 30 天。
  await window.webContents.executeJavaScript(`document.querySelector('[data-token-range="week"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await capture('usage-week', { singleScreen: true });
  await window.webContents.executeJavaScript(`(() => {
    const cols = document.querySelectorAll('.week-col');
    cols[cols.length - 3]?.click();
    const more = document.querySelector('.token-more');
    if (more) more.open = true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await capture('usage-week-detail');
  // 详情的展开状态是在 toggle 事件里记下的（异步），先收起、等它记完再切回 30 天，否则切换后会按「展开」恢复。
  await window.webContents.executeJavaScript(`(() => {
    const more = document.querySelector('.token-more');
    if (more) more.open = false;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-token-range="month"]').click();
    window.scrollTo(0, 0);
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await window.webContents.executeJavaScript(`document.querySelector('[data-view="radar"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('radar');
  // 展开第一张模型卡截一张，核对详情里的指标；截完收起，免得影响后面的截图。
  const openedModel = await window.webContents.executeJavaScript(`(() => {
    const detail = document.querySelector('#iqList details.model-detail');
    if (!detail) return false;
    detail.querySelector('summary').click();
    detail.scrollIntoView({ block: 'start' });
    return true;
  })()`);
  if (openedModel) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await capture('radar-model-open');
    await window.webContents.executeJavaScript(`(() => {
      const detail = document.querySelector('#iqList details.model-detail');
      if (detail?.open) detail.querySelector('summary').click();
      window.scrollTo(0, 0);
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  await window.webContents.executeJavaScript(`document.querySelector('[data-radar-view="quota"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await capture('radar-quota');
  await window.webContents.executeJavaScript(`document.querySelector('[data-radar-view="reset"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await capture('radar-reset');
  await window.webContents.executeJavaScript(`document.querySelector('[data-radar-view="intelligence"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await window.webContents.executeJavaScript(`document.querySelector('[data-provider="claude"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('claude-usage-after-switch');
  await window.webContents.executeJavaScript(`document.querySelector('[data-view="radar"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('claude-radar');
  await window.webContents.executeJavaScript(`document.querySelector('[data-radar-view="quota"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await capture('claude-radar-quota');
  await window.webContents.executeJavaScript(`document.querySelector('[data-radar-view="reset"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await capture('claude-radar-reset');
  await window.webContents.executeJavaScript(`document.querySelector('[data-view="usage"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('claude-usage', { singleScreen: true });
  // 曲线卡的读数：在曲线 60% 处按下，第一行换成那个时刻的已用百分比。
  const readout = await window.webContents.executeJavaScript(`(() => {
    const plot = document.querySelector('#paceCard:not([hidden]) .mini-plot');
    if (!plot) return null;
    const rect = plot.getBoundingClientRect();
    plot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: rect.left + rect.width * 0.6, clientY: rect.top + rect.height / 2 }));
    return document.querySelector('#paceCard .pace-line').textContent;
  })()`);
  if (readout !== null) {
    console.log(`readout: ${readout}`);
    await capture('claude-usage-readout');
  }
  // 并进「一周」卡的 Fable：手机上没有悬停提示，它的重置时间在这张卡的明细里。
  const scopedReset = await window.webContents.executeJavaScript(`(() => {
    const details = document.querySelector('details[data-detail="quota-week"]');
    if (!details) return null;
    details.open = true;
    return [...details.querySelectorAll('.quota-activity-row span')].map((node) => node.textContent).join(' | ');
  })()`);
  console.log(`claude-week-detail: ${scopedReset}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await capture('claude-week-detail');
  await window.webContents.executeJavaScript(`document.querySelector('details[data-detail="quota-week"]').open = false`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  // Claude 的「一周」卡带着 Fable，两个平台都测，确认并进去以后卡片没有变高。
  window.setSize(375, 667);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('claude-usage-compact', { singleScreen: true });
  window.setSize(320, 568);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('claude-usage-narrow', { singleScreen: true });
  // 7 天直方图比 30 天格子高，Claude 又带着 Fable，是最容易超出一屏的组合。
  await window.webContents.executeJavaScript(`document.querySelector('[data-token-range="week"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await capture('claude-usage-week-narrow', { singleScreen: true });
  window.setSize(375, 667);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('claude-usage-week-compact', { singleScreen: true });
  await window.webContents.executeJavaScript(`document.querySelector('[data-token-range="month"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await window.webContents.executeJavaScript(`document.querySelector('[data-provider="codex"]').click()`);
  window.setSize(375, 667);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('usage-compact', { singleScreen: true });
  window.setSize(320, 568);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('usage-narrow', { singleScreen: true });
  await window.webContents.executeJavaScript(`document.querySelector('[data-token-range="week"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await capture('usage-week-narrow', { singleScreen: true });
  window.setSize(375, 667);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('usage-week-compact', { singleScreen: true });
  await window.webContents.executeJavaScript(`document.querySelector('[data-token-range="month"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  window.setSize(320, 568);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await window.webContents.executeJavaScript(`document.querySelector('[data-view="radar"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('radar-narrow');

  window.destroy();
  await server.stop();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
