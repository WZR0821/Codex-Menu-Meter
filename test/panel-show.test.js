'use strict';

// 面板弹出方式的防回归检查：src/main.js 依赖 Electron 运行，没法直接单测，这里按源码检查。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

function functionBody(name) {
  const start = code.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name}() not found in src/main.js`);
  const open = code.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === '{') depth += 1;
    if (code[index] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open, index + 1);
    }
  }
  throw new Error(`${name}() is not closed`);
}

test('opening the panel never force-activates the app', () => {
  // 强制激活（app.focus）会让 macOS 从别的应用的全屏空间切回桌面空间：
  // 0.11.0 及以前「一点开面板就回主屏幕」就是这个原因。
  assert.doesNotMatch(code, /\bapp\.focus\s*\(/, 'src/main.js must not call app.focus()');
});

test('opening the panel orders it front even while another app is full screen', () => {
  // 不激活本应用时 show()（makeKeyAndOrderFront）不保证排到最前，别的应用全屏时面板会
  // 落在后面（0.11.1 的回归）；必须先 showInactive()（orderFrontRegardless）再 focus()。
  const show = functionBody('showPanelAnimated');
  assert.doesNotMatch(show, /panel\.show\(\)/, 'use panel.showInactive() instead of panel.show()');
  const inactive = show.indexOf('panel.showInactive()');
  assert.notEqual(inactive, -1);
  assert.ok(show.indexOf('panel.focus()') > inactive, 'focus() must follow showInactive()');
  assert.ok(show.indexOf('panel.showInactive()', inactive + 1) > inactive, 'the delayed fallback re-orders the panel front');
});

test('a blur right after opening does not close the panel', () => {
  // 全屏应用刚打开面板时可能把键盘焦点抢回去，这次失焦不能当成点到别处。
  assert.match(functionBody('handlePanelBlur'), /panelShownAt\s*<\s*POINTER_OPEN_GRACE_MS\)\s*return/);
});

test('the settings window opens on the current full-screen space', () => {
  const create = functionBody('createSettingsWindow');
  assert.match(create, /settingsWindow\.setVisibleOnAllWorkspaces\(true/);
  assert.match(create, /visibleOnFullScreen:\s*true/);
  assert.match(create, /skipTransformProcessType:\s*true/);
});

test('clicking a notification opens the panel', () => {
  const notify = functionBody('notify');
  assert.match(notify, /notification\.on\('click'/);
  assert.match(notify, /revealPanel\(\)/);
  assert.match(notify, /activeNotifications\.add\(notification\)/, 'keep a reference so the click handler survives GC');
});

test('reopening the panel does not leave a keyboard focus ring on the first button', () => {
  // showInactive() 弹出时，从第二次打开起 GPT 按钮会被当成键盘选中、一直带蓝色焦点框（1.0.0 的回归）。
  // 这一步可能在窗口 focus 事件之后才发生（面板页面正忙时，全屏下用户仍看到蓝框），
  // 所以焦点框必须由真实按键开关，而不能只靠 focus 事件里清焦点。
  const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.match(renderer, /window\.addEventListener\('focus',[\s\S]{0,300}?\.blur\(\)/);
  assert.match(renderer, /const KEYBOARD_FOCUS_CLASS = 'keyboard-focus'/);
  assert.match(renderer, /addEventListener\('keydown',[\s\S]{0,300}?classList\.add\(KEYBOARD_FOCUS_CLASS\)/,
    'a real key press turns focus rings on');
  assert.match(renderer, /addEventListener\('pointerdown',[\s\S]{0,120}?classList\.remove\(KEYBOARD_FOCUS_CLASS\)/,
    'pointer use turns focus rings off');
  assert.match(renderer, /motion === 'opening'\) armStrayFocusGuard\(\)/, 'reopening the panel turns focus rings off');
  assert.match(renderer, /addEventListener\('focusin',[\s\S]{0,300}?:focus-visible'\)\) target\.blur\(\)/,
    'stray keyboard-style focus right after opening is cleared');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles.css'), 'utf8');
  assert.match(styles, /body:not\(\.keyboard-focus\) :focus-visible \{\s*outline: none !important;/);
});

test('closing the panel or the settings window hands the keyboard back to the app that was in front', () => {
  // 在面板里点一下、打开设置窗口，都会把本应用切到前台（type: 'panel' 并不真的不激活应用）；
  // 收起面板、关掉设置窗口后若不交还，全屏应用要再点一下才能打字。
  const hide = functionBody('hidePanelAnimated');
  assert.ok(hide.indexOf('handFrontmostBack()') > hide.indexOf('panel.hide()'),
    'hand the foreground back only after the panel is hidden');
  assert.match(functionBody('createSettingsWindow'),
    /settingsWindow\.on\('closed', \(\) => \{\s*settingsWindow = null;\s*handFrontmostBack\(\);/);
  const handBack = functionBody('handFrontmostBack');
  assert.match(handBack, /if \(settingsWindow && !settingsWindow\.isDestroyed\(\)\) return;/,
    'keep the app in front while the settings window is open or opening');
  assert.match(handBack, /panel\.isVisible\(\) \|\| panelClosing\)\) return;/,
    'never hide the app while the panel is open or still closing');
  assert.match(handBack, /app\.hide\(\)/);
});

test('the panel stays a non-activating panel window above full-screen apps', () => {
  const create = functionBody('createPanel');
  assert.match(create, /type:\s*'panel'/);
  const prepare = functionBody('preparePanelForFullScreen');
  assert.match(prepare, /visibleOnFullScreen:\s*true/);
  assert.match(prepare, /skipTransformProcessType:\s*true/);
});
