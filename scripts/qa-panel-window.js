'use strict';

// Real Electron/AppKit integration check; run on a logged-in macOS desktop.
const assert = require('node:assert/strict');
const { app, BrowserWindow } = require('electron');
const { loadPanelBridge, createPanelPresenter } = require('../src/panel-window');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  app.dock.hide();
  const bridge = loadPanelBridge();
  const window = new BrowserWindow({
    width: 320, height: 180, show: false, frame: false, type: 'panel',
    transparent: true, fullscreenable: false, alwaysOnTop: true
  });
  const presenter = createPanelPresenter(window, { bridge });
  const handle = window.getNativeWindowHandle();
  assert.throws(() => bridge.prepare('invalid'), /Buffer/);
  assert.throws(() => bridge.inspect(Buffer.alloc(handle.length)), /no longer valid/);
  await window.loadURL('data:text/html,<body style="background:%23e9eef8;font:20px system-ui;padding:24px">Panel window integration test</body>');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    presenter.show();
    await delay(800);
    const state = bridge.inspect(handle);
    assert.equal(state.visible, true);
    assert.equal(state.onActiveSpace, true);
    assert.equal(state.transient, true);
    if (Number(process.getSystemVersion().split('.')[0]) >= 13) assert.equal(state.joinsAllApplications, true);
    assert.equal(state.level, 1001);
    console.log(`presentation ${attempt + 1}:`, JSON.stringify(state));
    presenter.cancel();
    window.hide();
    presenter.prepare(false);
    app.hide();
    await delay(750);
    assert.equal(bridge.inspect(handle).visible, false, 'delayed raises must not reopen the window');
    assert.equal(bridge.inspect(handle).level, 102);
  }
  presenter.cancel();
  window.destroy();
  assert.throws(() => bridge.inspect(handle), /no longer valid/);
  console.log('Native panel integration checks passed.');
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
