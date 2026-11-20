const test = require('node:test');
const assert = require('node:assert/strict');
const week = require('../src/mobile/token-week.js');

function day(date, models, extra = 0) {
  const tokens = models.reduce((sum, [, value]) => sum + value, 0) + extra;
  return { day: date, tokens, models: models.map(([model, value]) => ({ model, value })) };
}

const DAYS = [
  day('2026-11-15', [['claude-opus-5-5', 300], ['claude-sonnet-5-5', 50]]),
  day('2026-11-16', [['claude-fable-5-2', 500], ['claude-opus-5-5', 200]], 20),
  day('2026-11-17', [['claude-haiku-5-5', 40]]),
  day('2026-11-18', []),
  day('2026-11-19', [['claude-fable-5-2', 900], ['claude-sonnet-5-5', 100]]),
  day('2026-11-20', [['claude-opus-5-5', 400], ['claude-fable-5-2', 60]]),
  day('2026-11-21', [['claude-fable-5-2', 250], ['claude-opus-5-5', 120]])
];

test('series are ranked by 7-day total and keep their slot across days', () => {
  const series = week.weekSeries(DAYS);
  assert.deepEqual(series.named, ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5']);
  assert.equal(series.slots.get('claude-fable-5-2'), 1);
  assert.equal(series.slots.get('claude-opus-5-5'), 2);
  assert.equal(series.slots.get('claude-sonnet-5-5'), 3);
  // 第四个型号（haiku）和没记型号的 20 都并进「其他」。
  assert.equal(series.hasOther, true);
});

test('no other slot when every token belongs to a top model', () => {
  const series = week.weekSeries([day('2026-11-21', [['gpt-6.2-sol', 10], ['gpt-6.2', 5]])]);
  assert.deepEqual(series.named, ['gpt-6.2-sol', 'gpt-6.2']);
  assert.equal(series.hasOther, false);
});

test('ties are broken by name so colors do not flip between renders', () => {
  const series = week.weekSeries([day('2026-11-21', [['b-model', 10], ['a-model', 10]])]);
  assert.deepEqual(series.named, ['a-model', 'b-model']);
});

test('segments stack in slot order, fold the rest into other, and drop zeros', () => {
  const series = week.weekSeries(DAYS);
  assert.deepEqual(week.weekSegments(DAYS[1], series), [
    { slot: 1, value: 500 },
    { slot: 2, value: 200 },
    { slot: 'other', value: 20 }
  ]);
  assert.deepEqual(week.weekSegments(DAYS[2], series), [{ slot: 'other', value: 40 }]);
  assert.deepEqual(week.weekSegments(DAYS[3], series), []);
});

test('segment sum always equals the day total', () => {
  const series = week.weekSeries(DAYS);
  for (const item of DAYS) {
    const sum = week.weekSegments(item, series).reduce((total, segment) => total + segment.value, 0);
    assert.equal(sum, item.tokens);
  }
});

test('bar heights scale to the busiest day with a 4% floor for small days', () => {
  const heights = week.barHeights([{ total: 1000 }, { total: 500 }, { total: 1 }, { total: 0 }]);
  assert.deepEqual(heights, [100, 50, 4, 0]);
  assert.deepEqual(week.barHeights([{ total: 0 }, { total: 0 }]), [0, 0]);
});

test('model names follow the radar page style', () => {
  assert.equal(week.formatModelName('gpt-6.2-sol'), 'GPT-6.2 Sol');
  assert.equal(week.formatModelName('gpt-6.2'), 'GPT-6.2');
  assert.equal(week.formatModelName('claude-opus-5-5'), 'Opus 5.5');
  assert.equal(week.formatModelName('claude-fable-5-2-20261101'), 'Fable 5.2');
  assert.equal(week.formatModelName('kimi-k3'), 'kimi-k3');
});
