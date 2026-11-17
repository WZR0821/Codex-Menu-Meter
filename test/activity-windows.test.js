const assert = require('node:assert/strict');
const test = require('node:test');
const {
  FIVE_HOURS_MS,
  SEVEN_DAYS_MS,
  buildActivityWindows,
  currentWindowStart
} = require('../src/activity-windows');

test('uses official reset boundaries for current activity windows', () => {
  const now = Date.parse('2026-08-02T12:00:00Z');
  const fiveReset = now + 2 * 60 * 60 * 1000;
  const weekReset = now + 3 * 24 * 60 * 60 * 1000;
  const windows = buildActivityWindows([
    {
      ts: fiveReset - FIVE_HOURS_MS + 1,
      tokens: 100,
      ioTokens: 40,
      inputTokens: 80,
      cachedInputTokens: 60,
      sessionId: 'inside-five'
    },
    {
      ts: fiveReset - FIVE_HOURS_MS - 1,
      tokens: 200,
      ioTokens: 80,
      inputTokens: 160,
      cachedInputTokens: 120,
      sessionId: 'week-only'
    },
    {
      ts: weekReset - SEVEN_DAYS_MS - 1,
      tokens: 999,
      ioTokens: 999,
      inputTokens: 999,
      cachedInputTokens: 0,
      sessionId: 'outside'
    }
  ], {
    primaryWindow: { resetAt: fiveReset },
    secondaryWindow: { resetAt: weekReset }
  }, now);

  assert.equal(windows.fiveHour.basis, 'cycle');
  assert.equal(windows.fiveHour.tokens, 100);
  assert.equal(windows.fiveHour.cachedInputTokens, 60);
  assert.equal(windows.fiveHour.threads, 1);
  assert.equal(windows.week.tokens, 300);
  assert.equal(windows.week.threads, 2);
});

test('falls back to rolling windows when reset times are unavailable', () => {
  const now = Date.parse('2026-08-02T12:00:00Z');
  const value = currentWindowStart(null, FIVE_HOURS_MS, now);
  assert.deepEqual(value, {
    startAt: now - FIVE_HOURS_MS,
    endAt: now,
    basis: 'rolling'
  });
});
