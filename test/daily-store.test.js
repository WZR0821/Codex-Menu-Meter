const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDayRecords,
  createDayRecordBuilder,
  mergeDayRecords,
  normalizeStore,
  pruneStore,
  serializeStore,
  summarizeDayRecord,
  DAILY_STORE_VERSION
} = require('../src/daily-store.js');
const { entryCostUsd, setDynamicPrices, normalizeLiteLlmTable } = require('../src/model-pricing.js');

const at = (day, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).getTime();

function entry(day, overrides = {}) {
  const base = overrides.baseInputTokens ?? 1_000;
  const read = overrides.cachedInputTokens ?? 9_000;
  const output = overrides.outputTokens ?? 500;
  const write1h = overrides.cacheWrite1hTokens ?? 0;
  return {
    ts: at(day, overrides.hour),
    model: 'claude-opus-5-5',
    sessionId: 's1',
    speed: 'standard',
    baseInputTokens: base,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: write1h,
    cachedInputTokens: read,
    outputTokens: output,
    inputTokens: base + read + write1h,
    tokens: base + read + write1h + output,
    ioTokens: base + write1h + output,
    weighted: base + output * 5 + read * 0.1,
    ...overrides
  };
}

test('day records keep per-model, per-tier components and reprice to the per-entry cost', () => {
  const entries = [
    entry('2026-10-01'),
    entry('2026-10-01', { speed: 'fast', sessionId: 's2' }),
    entry('2026-10-01', { model: 'claude-haiku-5-5', baseInputTokens: 150_000, cachedInputTokens: 0 }),
    entry('2026-10-01', { model: 'mystery-model' }),
    entry('2026-10-02', { cacheWrite1hTokens: 4_000 })
  ];
  const records = buildDayRecords(entries);
  assert.deepEqual(Object.keys(records), ['2026-10-01', '2026-10-02']);
  const first = records['2026-10-01'];
  assert.equal(first.s, 2);
  assert.deepEqual(Object.keys(first.m['claude-opus-5-5']).sort(), ['f0', 's0']);
  assert.deepEqual(Object.keys(first.m['claude-haiku-5-5']), ['s128']);

  const summary = summarizeDayRecord('2026-10-01', first);
  const expected = entries.slice(0, 3).reduce((sum, item) => sum + entryCostUsd(item), 0);
  assert.ok(Math.abs(summary.costUsd - Math.round(expected * 100) / 100) < 1e-9);
  assert.equal(summary.tokens, entries.slice(0, 4).reduce((sum, item) => sum + item.tokens, 0));
  assert.equal(summary.unpricedTokens, entries[3].tokens);
  assert.deepEqual(summary.unpricedModels, ['mystery-model']);
  assert.equal(summary.archived, true);
  assert.deepEqual(summary.projects, []);

  // 改价后按新价重算：同一份记录、不同的价格表，费用跟着变。
  const before = summarizeDayRecord('2026-10-02', records['2026-10-02']).costUsd;
  setDynamicPrices({
    ...normalizeLiteLlmTable({
      'claude-opus-5-5': {
        litellm_provider: 'anthropic', mode: 'chat', input_cost_per_token: 8e-6, output_cost_per_token: 4e-5,
        cache_creation_input_token_cost: 1e-5, cache_creation_input_token_cost_above_1hr: 1.6e-5, cache_read_input_token_cost: 4e-7
      }
    }),
    fetchedAt: Date.now()
  });
  try {
    const after = summarizeDayRecord('2026-10-02', records['2026-10-02']).costUsd;
    assert.ok(Math.abs(after - before * 2) < 0.011, `${after} vs ${before}`);
  } finally {
    setDynamicPrices(null);
  }
});

test('the incremental builder matches the one-shot build', () => {
  const entries = [entry('2026-09-30', { hour: 23 }), entry('2026-10-01', { hour: 0 }), entry('2026-10-01', { hour: 9 })];
  const builder = createDayRecordBuilder();
  entries.forEach((item) => builder.add(item));
  assert.deepEqual(builder.finish(), buildDayRecords(entries));
  assert.deepEqual(Object.keys(buildDayRecords(entries, { fromTs: at('2026-10-01', 0) })), ['2026-10-01']);
});

test('merging keeps the larger record unless rebuilding, and tracks coverage', () => {
  const store = normalizeStore(null);
  const codex = store.providers.codex;
  assert.equal(mergeDayRecords(codex, buildDayRecords([entry('2026-10-05'), entry('2026-10-05')])), true);
  assert.equal(codex.coverageStart, '2026-10-05');
  const bigger = codex.days['2026-10-05'];
  // 日志被清理后新算的变少：保留已存的。
  assert.equal(mergeDayRecords(codex, buildDayRecords([entry('2026-10-05')])), false);
  assert.equal(codex.days['2026-10-05'], bigger);
  // 同样的内容不算变化。
  assert.equal(mergeDayRecords(codex, { '2026-10-05': JSON.parse(JSON.stringify(bigger)) }), false);
  // 口径升级后的重建：以新算的为准。
  assert.equal(mergeDayRecords(codex, buildDayRecords([entry('2026-10-05')]), { replace: true }), true);
  assert.ok(codex.days['2026-10-05'].t < bigger.t);
  // 更早的一天进来，覆盖起点前移。
  mergeDayRecords(codex, buildDayRecords([entry('2026-09-01')]));
  assert.equal(codex.coverageStart, '2026-09-01');
});

test('store round-trips, rebuilds on version change and prunes old days', () => {
  const store = normalizeStore(null);
  mergeDayRecords(store.providers.claude, buildDayRecords([entry('2024-01-01'), entry('2026-11-01')]));
  store.providers.claude.backfilled = true;
  const restored = normalizeStore(JSON.parse(serializeStore(store)));
  assert.equal(restored.providers.claude.backfilled, true);
  assert.deepEqual(Object.keys(restored.providers.claude.days).sort(), ['2024-01-01', '2026-11-01']);
  pruneStore(restored, at('2026-11-23'));
  assert.deepEqual(Object.keys(restored.providers.claude.days), ['2026-11-01']);

  const older = JSON.parse(serializeStore(store));
  older.version = DAILY_STORE_VERSION - 1;
  const upgraded = normalizeStore(older);
  assert.equal(upgraded.providers.claude.backfilled, false);
  assert.equal(upgraded.providers.claude.rebuild, true);
  assert.equal(Object.keys(upgraded.providers.claude.days).length, 2);
  // 坏数据：跳过不合法的天。
  const messy = normalizeStore({ version: DAILY_STORE_VERSION, providers: { codex: { days: { bad: { t: 1 }, '2026-11-02': { t: 'x' }, '2026-11-03': { t: 5 } } } } });
  assert.deepEqual(Object.keys(messy.providers.codex.days), ['2026-11-03']);
});
