'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPanelPresenter } = require('../src/panel-window');

function fixture() {
  const calls = [];
  const jobs = [];
  let destroyed = false;
  let onActiveSpace = true;
  const window = {
    isDestroyed: () => destroyed,
    // An occluded native window must still be recovered.
    isVisible: () => false,
    getNativeWindowHandle: () => Buffer.alloc(8),
    setVisibleOnAllWorkspaces: (...args) => calls.push(['spaces', ...args]),
    setHiddenInMissionControl: (value) => calls.push(['transient', value]),
    setAlwaysOnTop: (...args) => calls.push(['level', ...args]),
    showInactive: () => calls.push(['show']),
    focus: () => calls.push(['focus']),
    moveTop: () => calls.push(['raise'])
  };
  const presenter = createPanelPresenter(window, {
    platform: 'darwin',
    bridge: {
      prepare: () => calls.push(['native-policy']),
      inspect: () => ({ onActiveSpace })
    },
    schedule: (callback, delay) => { const job = { callback, delay }; jobs.push(job); return job; },
    cancel: (job) => { job.cancelled = true; }
  });
  return { presenter, calls, jobs, destroy: () => { destroyed = true; }, leaveSpace: () => { onActiveSpace = false; } };
}

test('presentation restores the overlay policy after show and focus', () => {
  const { presenter, calls } = fixture();
  presenter.show();
  assert.deepEqual(calls.filter(([name]) => ['show', 'focus', 'native-policy', 'raise'].includes(name)),
    [['native-policy'], ['show'], ['focus'], ['native-policy'], ['raise']]);
  assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(['level', true, 'screen-saver', 1])));
  assert.equal(presenter.isRequested(), true);
});

test('occluded windows are raised again after menu-bar and Space transitions', () => {
  const { presenter, calls, jobs } = fixture();
  presenter.show();
  assert.deepEqual(jobs.map((job) => job.delay), [120, 300, 650]);
  jobs.forEach((job) => job.callback());
  assert.equal(calls.filter(([name]) => name === 'show').length, 4);
  assert.equal(calls.filter(([name]) => name === 'focus').length, 1, 'recovery does not keep stealing keyboard focus');
});

test('closing cancels recovery and restores the hidden-window level', () => {
  const { presenter, calls, jobs } = fixture();
  presenter.show();
  presenter.cancel();
  const before = calls.length;
  jobs.forEach((job) => job.callback());
  assert.equal(calls.length, before, 'even queued callbacks cannot reopen a closed panel');
  assert.ok(jobs.every((job) => job.cancelled));
  assert.equal(presenter.isRequested(), false);
  presenter.prepare(false);
  assert.deepEqual(calls.filter(([name]) => name === 'level').at(-1), ['level', true, 'pop-up-menu', 1]);
});

test('old retries cannot affect a later presentation or destroyed window', () => {
  const { presenter, calls, jobs, destroy } = fixture();
  presenter.show();
  const previous = [...jobs];
  presenter.cancel();
  presenter.show();
  const before = calls.length;
  previous.forEach((job) => job.callback());
  assert.equal(calls.length, before);
  destroy();
  jobs.forEach((job) => job.callback());
  assert.equal(calls.length, before);
});

test('a visible window on another Space is not considered a current-Space panel', () => {
  const { presenter, leaveSpace } = fixture();
  assert.equal(presenter.isOnActiveSpace(), true);
  leaveSpace();
  assert.equal(presenter.isOnActiveSpace(), false);
});
