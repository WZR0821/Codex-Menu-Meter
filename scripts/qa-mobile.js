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
  // Claude 的专项周限额（Fable）会在两张额度卡下面多占一行，单屏检查要把它算进去。
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
  await window.webContents.executeJavaScript(`document.querySelector('[data-view="radar"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('radar');
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
  // Claude 用量页多一行 Fable，是三种屏高里最容易超出一屏的情形，所以两个平台都测。
  window.setSize(375, 667);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('claude-usage-compact', { singleScreen: true });
  window.setSize(320, 568);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('claude-usage-narrow', { singleScreen: true });
  await window.webContents.executeJavaScript(`document.querySelector('[data-provider="codex"]').click()`);
  window.setSize(375, 667);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('usage-compact', { singleScreen: true });
  window.setSize(320, 568);
  await new Promise((resolve) => setTimeout(resolve, 450));
  await capture('usage-narrow', { singleScreen: true });
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
