// 生成手机端主屏图标（PNG）。iOS 的「添加到主屏幕」不认 SVG，没有 PNG 时会拿页面截图当图标。
// 与桌面共用 assets/icon-source.png，铺白色底：iOS / Android 会自己裁圆角，
// 透明的角在 iOS 上会变成黑边。
// 用法：npx electron scripts/build-mobile-icons.js
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'src', 'mobile');
const SIZES = [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']];

// 只开一个窗口、按最大尺寸画一次，再缩成各个尺寸（逐个开窗口时第二个渲染进程常常起不来）。
app.whenReady().then(async () => {
  const size = Math.max(...SIZES.map(([value]) => value));
  const window = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    frame: false,
    useContentSize: true,
    enableLargerThanScreen: true,
    webPreferences: { offscreen: true }
  });
  const source = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon-source.png'))
    .resize({ width: size, height: size, quality: 'best' }).toDataURL();
  const html = `<!doctype html><html><body style="margin:0;background:#fff">
    <img style="display:block;width:${size}px;height:${size}px" src="${source}">
  </body></html>`;
  await window.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const captured = await window.webContents.capturePage();
  for (const [target, name] of SIZES) {
    const image = captured.resize({ width: target, height: target, quality: 'best' });
    await fs.writeFile(path.join(OUT_DIR, name), image.toPNG());
    console.log(name, target, image.getSize());
  }
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
