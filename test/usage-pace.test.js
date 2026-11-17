const test = require('node:test');
const assert = require('node:assert/strict');
const pace = require('../src/mobile/usage-pace.js');

const NOW = Date.parse('2026-11-13T03:20:00Z');

function weekWindow(usedPercent, elapsedRatio) {
  return { usedPercent, remainingPercent: 100 - usedPercent, resetAt: NOW + (1 - elapsedRatio) * pace.WEEK_MS };
}

test('ahead of pace projects a run-out before reset', () => {
  const result = pace.computePace(weekWindow(41, 0.23), { durationMs: pace.WEEK_MS, now: NOW });
  assert.equal(result.status, 'ahead');
  assert.equal(result.tier, 'serious');
  assert.equal(Math.round(result.elapsedPercent), 23);
  assert.equal(Math.round(result.delta), 18);
  assert.equal(result.lastsUntilReset, false);
  assert.ok(result.runOutAt > NOW && result.runOutAt < result.resetAt);
  assert.ok(result.earlyByMs > 2 * pace.DAY_MS);
});

test('slightly ahead is a warning, behind stays good', () => {
  assert.equal(pace.computePace(weekWindow(30, 0.22), { durationMs: pace.WEEK_MS, now: NOW }).tier, 'warning');
  const behind = pace.computePace(weekWindow(10, 0.5), { durationMs: pace.WEEK_MS, now: NOW });
  assert.equal(behind.status, 'behind');
  assert.equal(behind.tier, 'good');
  assert.equal(behind.lastsUntilReset, true);
  assert.equal(behind.runOutAt, null);
});

test('early in the window no projection is made', () => {
  const windowValue = { usedPercent: 6, resetAt: NOW + pace.FIVE_HOUR_MS - 5 * 60_000 };
  const result = pace.computePace(windowValue, { durationMs: pace.FIVE_HOUR_MS, now: NOW });
  assert.equal(result.status, 'early');
  assert.equal(result.runOutAt, null);
});

test('past resetAt is reported as reset, exhausted as critical', () => {
  assert.equal(pace.computePace({ usedPercent: 80, resetAt: NOW - 1000 }, { durationMs: pace.FIVE_HOUR_MS, now: NOW }).status, 'reset');
  const exhausted = pace.computePace({ usedPercent: 100, resetAt: NOW + 3600_000 }, { durationMs: pace.FIVE_HOUR_MS, now: NOW });
  assert.equal(exhausted.status, 'exhausted');
  assert.equal(exhausted.tier, 'critical');
});

test('listWindows skips the codex 5h card when unlimited and keeps claude extras as weekly', () => {
  const codex = pace.listWindows({ fiveHourUnlimited: true, primaryWindow: null, secondaryWindow: weekWindow(20, 0.4) }, { provider: 'codex', now: NOW });
  assert.deepEqual(codex.map((item) => item.key), ['week']);
  const claude = pace.listWindows({
    primaryWindow: { usedPercent: 10, resetAt: NOW + 3600_000 },
    secondaryWindow: weekWindow(12, 0.23),
    extraWindows: [{ ...weekWindow(41, 0.23), name: 'Fable' }, { usedPercent: 0, resetAt: null, inactive: true, name: 'Opus' }]
  }, { provider: 'claude', now: NOW });
  assert.deepEqual(claude.map((item) => item.key), ['five', 'week', 'extra:Fable']);
  assert.equal(claude[2].durationMs, pace.WEEK_MS);
  assert.equal(pace.tightestWindow(claude).key, 'extra:Fable');
  assert.equal(pace.mostUrgent(claude).key, 'extra:Fable');
});

test('compactSamples keeps the last sample per bucket and the peak before a reset', () => {
  const t0 = Date.parse('2026-11-10T00:00:00Z');
  const samples = [
    { t: t0, five: 10 },
    { t: t0 + 60_000, five: 20 },
    { t: t0 + 120_000, five: 2 },
    { t: t0 + 180_000, five: 4 },
    { t: t0 + 20 * 60_000, five: 9 }
  ];
  const compacted = pace.compactSamples(samples, 15 * 60_000, ['five']);
  assert.deepEqual(compacted.map((sample) => sample.five), [20, 4, 9]);
});

test('compactSamples also keeps the peak before a per-model window resets', () => {
  const t0 = Date.parse('2026-11-10T00:00:00Z');
  const samples = [
    { t: t0, five: 10, ex: { Fable: 80 } },
    { t: t0 + 60_000, five: 11, ex: { Fable: 1 } },
    { t: t0 + 120_000, five: 12, ex: { Fable: 2 } }
  ];
  const compacted = pace.compactSamples(samples, 15 * 60_000, ['five']);
  assert.deepEqual(compacted.map((sample) => sample.ex.Fable), [80, 2]);
});

test('isStale compares fetchedAt with the allowed age', () => {
  assert.equal(pace.isStale(NOW - 10 * 60_000, 5 * 60_000, NOW), true);
  assert.equal(pace.isStale(NOW - 60_000, 5 * 60_000, NOW), false);
  assert.equal(pace.isStale(null, 5 * 60_000, NOW), false);
});
