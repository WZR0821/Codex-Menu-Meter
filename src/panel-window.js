'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadPanelBridge() {
  if (process.platform !== 'darwin') return null;
  const candidates = [
    path.join(process.resourcesPath || '', 'panel-window.node'),
    path.join(__dirname, '..', 'native', 'panel-window.node')
  ];
  const filename = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filename) throw new Error('Missing panel-window.node; run npm run build:panel');
  return require(filename);
}

function createPanelPresenter(window, {
  bridge = null,
  platform = process.platform,
  schedule = setTimeout,
  cancel = clearTimeout
} = {}) {
  let requested = false;
  let generation = 0;
  let timers = [];

  function cancelPending() {
    generation += 1;
    timers.forEach(cancel);
    timers = [];
  }

  function prepare(presenting = requested) {
    if (window.isDestroyed()) return;
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    window.setHiddenInMissionControl(true);
    window.setAlwaysOnTop(true, platform === 'darwin' && presenting ? 'screen-saver' : 'pop-up-menu', 1);
    bridge?.prepare(window.getNativeWindowHandle());
  }

  function raise(focus = false) {
    prepare(true);
    window.showInactive();
    if (focus) window.focus();
    // Chromium can update native collection behavior while showing/focusing.
    // Apply the overlay policy after that transition as well as before it.
    prepare(true);
    window.moveTop();
  }

  return {
    prepare,
    isRequested: () => requested,
    isOnActiveSpace: () => bridge ? bridge.inspect(window.getNativeWindowHandle()).onActiveSpace : true,
    show() {
      cancelPending();
      requested = true;
      const current = generation;
      raise(true);
      // Menu-bar collapse and Space transitions can outlast a single 120 ms
      // retry. Never gate recovery on isVisible(): occlusion is what we repair.
      timers = [120, 300, 650].map((delay) => schedule(() => {
        if (window.isDestroyed() || !requested || generation !== current) return;
        raise();
      }, delay));
    },
    cancel() {
      requested = false;
      cancelPending();
    }
  };
}

module.exports = { loadPanelBridge, createPanelPresenter };
