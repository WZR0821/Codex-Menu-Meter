const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ForegroundProviderTracker,
  detectForegroundProvider
} = require('../src/foreground-provider');

test('detects Codex from its desktop bundle identifier', () => {
  assert.equal(detectForegroundProvider({
    bundleId: 'com.openai.codex',
    name: 'ChatGPT'
  }), 'codex');
});

test('detects Claude Code from the Claude desktop bundle identifier', () => {
  assert.equal(detectForegroundProvider({
    bundleId: 'com.anthropic.claudefordesktop',
    name: 'Claude'
  }), 'claude');
});

test('uses exact application names as a compatibility fallback', () => {
  assert.equal(detectForegroundProvider({ name: 'Codex' }), 'codex');
  assert.equal(detectForegroundProvider({ name: 'Claude Code' }), 'claude');
});

test('ignores unrelated foreground applications', () => {
  assert.equal(detectForegroundProvider({
    bundleId: 'com.apple.Safari',
    name: 'Safari',
    bundlePath: '/Applications/Safari.app'
  }), null);
});

test('keeps a manual provider choice while the same application stays in front', () => {
  const tracker = new ForegroundProviderTracker();
  tracker.update({
    bundleId: 'com.openai.codex',
    name: 'ChatGPT',
    pid: '100'
  });
  assert.equal(tracker.recommendedProvider(), 'codex');

  tracker.markManualOverride();
  assert.equal(tracker.recommendedProvider(), null);

  tracker.update({
    bundleId: 'com.openai.codex',
    name: 'ChatGPT',
    pid: '100'
  });
  assert.equal(tracker.recommendedProvider(), null);
});

test('resumes automatic switching after the foreground application changes', () => {
  const tracker = new ForegroundProviderTracker();
  tracker.update({ bundleId: 'com.openai.codex', name: 'ChatGPT', pid: '100' });
  tracker.markManualOverride();

  tracker.update({ bundleId: 'com.apple.Safari', name: 'Safari', pid: '200' });
  assert.equal(tracker.recommendedProvider(), null);

  tracker.update({ bundleId: 'com.openai.codex', name: 'ChatGPT', pid: '100' });
  assert.equal(tracker.recommendedProvider(), 'codex');
});
