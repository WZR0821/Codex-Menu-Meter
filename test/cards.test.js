const test = require('node:test');
const assert = require('node:assert/strict');
const CARDS = require('../src/mobile/cards.js');

const NOW = new Date(2026, 10, 23, 15, 30); // 2026-11-23（周一）下午

function iso(offsetDays) {
  return CARDS.isoDate(new Date(2026, 10, 23 + offsetDays));
}

function day(offsetDays, tokens, extra = {}) {
  return {
    day: iso(offsetDays),
    tokens,
    ioTokens: Math.round(tokens / 10),
    inputTokens: tokens,
    cachedInputTokens: Math.round(tokens * 0.9),
    costUsd: tokens / 1e6,
    threads: 1,
    models: [{ model: 'gpt-6.1-sol', value: tokens }],
    ...extra
  };
}

test('7-day view has one bucket per day ending today, and compares with the 7 days before', () => {
  const days = [];
  for (let offset = -29; offset <= 0; offset += 1) days.push(day(offset, 1000));
  const view = CARDS.buildView('week', { days }, { now: NOW });
  assert.equal(view.buckets.length, 7);
  assert.equal(view.buckets[0].key, iso(-6));
  assert.equal(view.buckets.at(-1).key, iso(0));
  assert.ok(view.buckets.every((bucket) => bucket.kind === 'day' && bucket.totals.dayCount === 1));
  assert.equal(view.totals.tokens, 7000);
  assert.equal(view.dayCount, 7);
  // 记录从 29 天前开始，前 7 天完整：可以对比；两段一样多 → 持平。
  assert.ok(view.change);
  assert.equal(view.change.days, 7);
  assert.equal(CARDS.changeInfo(view, 'zh-CN').direction, 'flat');
});

test('90-day view groups 13 seven-day blocks ending today; the oldest block has 6 days', () => {
  const view = CARDS.buildView('quarter', { days: [day(0, 10)] }, { now: NOW });
  assert.equal(view.buckets.length, 13);
  assert.equal(view.buckets.at(-1).end, iso(0));
  assert.equal(view.buckets.at(-1).start, iso(-6));
  assert.equal(view.buckets[0].start, iso(-89));
  assert.equal(view.buckets[0].totals.dayCount, 6);
  assert.equal(view.buckets.reduce((sum, bucket) => sum + bucket.totals.dayCount, 0), 90);
  assert.equal(view.dayCount, 90);
  assert.equal(view.rangeStart, iso(-89));
});

test('1-year view is 12 calendar months, the current one counted up to today', () => {
  const view = CARDS.buildView('year', { days: [day(0, 10)] }, { now: NOW });
  assert.equal(view.buckets.length, 12);
  assert.equal(view.buckets[0].start, '2025-12-01');
  assert.equal(view.buckets[0].end, '2025-12-31');
  assert.equal(view.buckets[2].end, '2026-02-28');
  assert.equal(view.buckets.at(-1).start, '2026-11-01');
  assert.equal(view.buckets.at(-1).end, '2026-11-23');
  assert.equal(view.change, null, 'the year view never compares');
});

test('history days (stored summaries) fill in before the 30-day live window; live days win on overlap', () => {
  const activity = {
    days: [day(0, 500), { ...day(1, 999), future: true }],
    history: {
      status: 'ready',
      coverageStart: iso(-200),
      days: [day(-40, 100), day(-100, 300), { ...day(0, 1) }]
    }
  };
  const quarter = CARDS.buildView('quarter', activity, { now: NOW });
  assert.equal(quarter.totals.tokens, 600, '-40 and today (live 500, not the stored 1); -100 is outside 90 days');
  const year = CARDS.buildView('year', activity, { now: NOW });
  assert.equal(year.totals.tokens, 900);
  assert.equal(year.historyStatus, 'ready');
});

test('comparison needs the whole previous period on record and some usage in it', () => {
  const recent = [day(0, 2000), day(-3, 1000)];
  // 记录最早一天晚于上一段开头：不比。
  let view = CARDS.buildView('month', { days: recent, history: { status: 'ready', coverageStart: iso(-40), days: [day(-40, 500)] } }, { now: NOW });
  assert.equal(view.change, null);
  // 上一段完整（记录从 70 天前起）：3000 对 1500 → 多 100%。
  view = CARDS.buildView('month', { days: recent, history: { status: 'ready', coverageStart: iso(-70), days: [day(-40, 1500)] } }, { now: NOW });
  assert.ok(view.change);
  assert.equal(Math.round(view.change.ratio * 100), 100);
  const info = CARDS.changeInfo(view, 'zh-CN');
  assert.equal(info.direction, 'up');
  assert.equal(info.short, '↑100%');
  assert.equal(info.title, '比前 30 天多 100%');
  // 上一段完全没用：不比（避免「多了无穷大」）。
  view = CARDS.buildView('month', { days: recent, history: { status: 'ready', coverageStart: iso(-70), days: [day(-70, 5)] } }, { now: NOW });
  assert.equal(view.change, null);
  assert.equal(CARDS.changeHtml(view, 'zh-CN'), '');
});

test('sparse axis labels count from the right; the selected bar always gets its label', () => {
  assert.deepEqual(
    CARDS.labelVisibility(13, 3, 12).map((value, index) => (value ? index : null)).filter((index) => index !== null),
    [0, 3, 6, 9, 12]
  );
  const selected = CARDS.labelVisibility(13, 3, 11);
  assert.equal(selected[11], true);
  assert.equal(selected[12], false, 'the neighbour gives way');
  assert.equal(selected[9], true);
  assert.deepEqual(CARDS.labelVisibility(7, 1, 2), Array(7).fill(true));
});

test('both skins render the same chart structure with their own class names', () => {
  const days = [day(0, 3000), day(-1, 1000, { models: [{ model: 'claude-opus-5-5', value: 600 }, { model: 'claude-fable-5-2', value: 400 }] })];
  const view = CARDS.buildView('week', { days }, { now: NOW });
  const desktop = CARDS.chartHtml(view, { lang: 'zh-CN', skin: 'desktop', selectedKey: iso(-1), columnAttrs: () => 'data-extra="1"' });
  const mobile = CARDS.chartHtml(view, { lang: 'zh-CN', skin: 'mobile', selectedKey: iso(-1) });
  assert.equal((desktop.match(/class="token-week-col/g) || []).length, 7);
  assert.equal((mobile.match(/class="week-col/g) || []).length, 7);
  assert.match(desktop, /token-week-col selected" tabindex="0" role="button" aria-pressed="true" data-day="2026-11-22"/);
  assert.match(mobile, /<button class="week-col active" type="button" aria-pressed="true" data-day="2026-11-22"/);
  assert.equal((desktop.match(/data-extra="1"/g) || []).length, 7);
  // 图例：三个模型各一色。
  assert.match(desktop, /GPT-6\.1 Sol/);
  assert.match(mobile, /Opus 5\.5/);
  const quarter = CARDS.buildView('quarter', { days }, { now: NOW });
  const quarterHtml = CARDS.chartHtml(quarter, { lang: 'en-US', skin: 'mobile' });
  assert.match(quarterHtml, /week-plot sparse" style="--week-cols:13"/);
  assert.match(quarterHtml, /data-bucket="2026-11-17~2026-11-23"/);
  assert.equal((quarterHtml.match(/is-blank/g) || []).length, 8);
});

test('bucket details list both the bucket and the whole range, with notes', () => {
  const activity = {
    pricingAsOf: '2026-11-20',
    days: [day(0, 4000), day(-2, 2000, { unpricedTokens: 50, unpricedModels: ['gpt-x'] })],
    history: { status: 'pending', coverageStart: iso(-29), days: [] }
  };
  const view = CARDS.buildView('quarter', activity, { now: NOW });
  const bucket = CARDS.selectedBucket(view, null);
  assert.equal(bucket.key, `${iso(-6)}~${iso(0)}`);
  assert.equal(bucket.totals.activeDays, 2);
  const html = CARDS.bucketDetailHtml(view, bucket, { lang: 'zh-CN' });
  assert.match(html, /11\/17–11\/23/);
  assert.match(html, /近 90 天/);
  assert.match(html, /2\/7 天有用量/);
  assert.match(html, /正在整理更早的本地记录/);
  assert.match(html, /未定价型号/);
  assert.match(html, /11\/20 的公开牌价/);
  assert.match(html, /range-models/);
  assert.equal(CARDS.summaryText(bucket, 'zh-CN'), '11/17–11/23 · 6,000 token');
});

test('attribution converts the weekly used percent into per-project points', () => {
  const model = CARDS.attributionModel(
    { usedPercent: 40, remainingPercent: 60 },
    { attribution: { costUsd: 100, pricedTokens: 8e8, projects: [
      { name: 'alpha', costUsd: 60, tokens: 5e8 },
      { name: 'beta', costUsd: 30, tokens: 2e8 },
      { name: null, other: 3, costUsd: 10, tokens: 1e8 }
    ] } }
  );
  assert.equal(model.ready, true);
  assert.equal(model.perPointUsd, 2.5);
  assert.equal(model.tokensPerPoint, 2e7);
  assert.deepEqual(model.rows.map((row) => Math.round(row.points)), [24, 12, 4]);
  assert.equal(model.rows[2].other, 3);
  const html = CARDS.attributionHtml(model, { lang: 'zh-CN' });
  assert.equal((html.match(/<li class="attribution-row/g) || []).length, 3);
  assert.match(html, /1% ≈ \$2\.50 · 2000\.00 万 token/);
  assert.match(html, /其他 3 个/);
  assert.match(html, /≈24%/);
});

test('attribution keeps three rows: older payloads with more projects fold into "other", too little usage shows a note', () => {
  const folded = CARDS.attributionModel(
    { usedPercent: 10 },
    { attribution: { costUsd: 10, pricedTokens: 1000, projects: [
      { name: 'a', costUsd: 4, tokens: 1 },
      { name: 'b', costUsd: 3, tokens: 1 },
      { name: 'c', costUsd: 2, tokens: 1 },
      { name: null, other: 2, costUsd: 1, tokens: 1 }
    ] } }
  );
  assert.equal(folded.rows.length, 3);
  assert.equal(folded.rows[2].other, 3);
  assert.equal(folded.rows[2].costUsd, 3);

  const early = CARDS.attributionModel({ usedPercent: 0 }, { attribution: { costUsd: 5, pricedTokens: 10, projects: [{ name: 'a', costUsd: 5, tokens: 10 }] } });
  assert.equal(early.ready, false);
  const html = CARDS.attributionHtml(early, { lang: 'en-US' });
  assert.equal((html.match(/<li class="attribution-row/g) || []).length, 3);
  assert.match(html, /Too little usage this week/);

  assert.equal(CARDS.attributionModel(null, { attribution: {} }), null);
  assert.equal(CARDS.attributionModel({ usedPercent: 5, inactive: true }, { attribution: { costUsd: 1 } }), null);
  assert.equal(CARDS.attributionHtml(null, { lang: 'zh-CN' }), '');
});

test('range toggle has four equal buttons and unknown ranges fall back to 30 days', () => {
  const html = CARDS.toggleHtml('quarter', 'ja-JP', 'trend-range-button');
  assert.equal((html.match(/<button/g) || []).length, 4);
  assert.match(html, /class="trend-range-button active" data-token-range="quarter" aria-pressed="true">90日/);
  assert.equal(CARDS.normalizeRange('decade'), 'month');
  assert.equal(CARDS.statLabel(CARDS.buildView('year', {}, { now: NOW }), 'en-US'), '12-month used');
  assert.equal(CARDS.statLabel(CARDS.buildView('quarter', {}, { now: NOW }), 'zh-CN'), '近 90 天已使用');
});

test('formatting matches the panel: tokens, dollars, cache hit and points', () => {
  assert.equal(CARDS.formatTokens('zh-CN', 123456789), '1.23 亿 token');
  assert.equal(CARDS.formatTokens('ja-JP', 12345, false), '1.23 万');
  assert.equal(CARDS.formatTokens('en-US', 2.5e9), '2.50B tokens');
  assert.equal(CARDS.formatUsd(123.4), '$123');
  assert.equal(CARDS.formatUsd(12.34), '$12.3');
  assert.equal(CARDS.formatCacheHit('zh-CN', 99, 100), '99%');
  assert.equal(CARDS.formatCacheHit('zh-CN', null, 100), '--');
  assert.equal(CARDS.cacheHitTone(96, 100), 'cache-hit-warning');
  // 分界 97 / 93，按保留 1 位小数后显示出来的数判色。
  assert.equal(CARDS.cacheHitTone(97, 100), 'cache-hit-good');
  assert.equal(CARDS.cacheHitTone(96.96, 100), 'cache-hit-good');
  assert.equal(CARDS.cacheHitTone(96.94, 100), 'cache-hit-warning');
  assert.equal(CARDS.cacheHitTone(93, 100), 'cache-hit-warning');
  assert.equal(CARDS.cacheHitTone(92.94, 100), 'cache-hit-critical');
  assert.equal(CARDS.cacheHitTone(null, 100), 'cache-hit-neutral');
  assert.equal(CARDS.formatPoints(0.05), '<0.1%');
  assert.equal(CARDS.formatPoints(3.44), '≈3.4%');
  assert.equal(CARDS.formatPoints(23.6), '≈24%');
});
