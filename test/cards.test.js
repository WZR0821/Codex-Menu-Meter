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

const HOUR = 3_600_000;

function sampleReport(extra = {}) {
  return {
    start: '2026-11-16',
    end: '2026-11-22',
    previousStart: '2026-11-09',
    tokens: 3000,
    ioTokens: 300,
    inputTokens: 2800,
    cachedInputTokens: 2700,
    costUsd: 12.5,
    unpricedTokens: 40,
    sessions: 6,
    activeDays: 4,
    busiestDay: { day: '2026-11-19', tokens: 1500 },
    busiestHour: { hour: 14, tokens: 900 },
    models: [
      { model: 'claude-opus-5-5', tokens: 2000, costUsd: 10 },
      { model: 'claude-fable-5-2', tokens: 600, costUsd: 2 },
      { model: 'claude-sonnet-5-5', tokens: 300, costUsd: 0.5 },
      { model: null, other: 2, tokens: 100, costUsd: null }
    ],
    projects: [
      { name: 'alpha', tokens: 1800, costUsd: 8, sessions: 3 },
      { name: 'beta', tokens: 900, costUsd: 3, sessions: 2 },
      { name: null, other: 3, tokens: 300, costUsd: 1.5, sessions: 1 }
    ],
    previousTokens: 2000,
    quotaLow: { usedPercent: 87.6, at: new Date(2026, 10, 21, 21, 10).getTime() },
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

test('the 90-day view is gone: a stored "quarter" choice falls back to 30 days', () => {
  assert.equal(CARDS.normalizeRange('quarter'), 'month');
  assert.deepEqual(CARDS.RANGES, ['week', 'month', 'year', 'recap']);
  assert.equal(CARDS.buildView('quarter', { days: [day(0, 10)] }, { now: NOW }).range, 'month');
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
  const month = CARDS.buildView('month', activity, { now: NOW });
  assert.equal(month.totals.tokens, 500, 'today counts the live 500, not the stored 1; -40 is outside 30 days');
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
  assert.doesNotMatch(desktop, /is-blank|sparse/, 'every day of the week gets its label');
});

test('the 1-year view is a line: one point per month, nothing drawn before local records start', () => {
  const days = [day(0, 3000), day(-1, 1000)];
  // 记录从 3 月 10 日开始：12 月、1 月、2 月不画线；5 月最多
  const activity = { days, history: { status: 'ready', coverageStart: '2026-03-10', days: [day(-200, 5000)] } };
  const view = CARDS.buildView('year', activity, { now: NOW });
  const mobile = CARDS.chartHtml(view, { lang: 'en-US', skin: 'mobile' });
  assert.match(mobile, /class="week-chart is-line"/);
  assert.match(mobile, /class="week-plot line-plot" style="--week-cols:12"/);
  assert.equal((mobile.match(/class="week-col line-col/g) || []).length, 12);
  assert.equal((mobile.match(/is-uncovered/g) || []).length, 3);
  assert.match(mobile, /<path class="line-stroke" d="M291\.7 /, 'the line starts in the first covered month (March)');
  assert.match(mobile, /<path class="line-area" d="M291\.7 [^"]+ L958\.3 100 L291\.7 100 Z"/);
  assert.match(mobile, /<button class="week-col line-col active" type="button" aria-pressed="true" data-bucket="2026-11-01~2026-11-23"/);
  assert.equal((mobile.match(/is-blank/g) || []).length, 6, 'every other month is labelled, counting from this month');
  assert.match(mobile, /Peak May · 5,000 tokens/);
  assert.doesNotMatch(mobile, /week-bar|week-seg/, 'no bars in the year view');
  // 最高的月份画在 84% 高，不贴着顶
  assert.match(mobile, /data-bucket="2026-05-01~2026-05-31"[^>]*style="--y:84\.0%"/);

  let calls = 0;
  const desktop = CARDS.chartHtml(view, { lang: 'zh-CN', skin: 'desktop', selectedKey: '2026-05-01~2026-05-31', columnAttrs: () => { calls += 1; return 'data-extra="1"'; } });
  assert.match(desktop, /class="token-week is-line"/);
  assert.match(desktop, /token-week-col line-col selected" tabindex="0" role="button" aria-pressed="true" data-bucket="2026-05-01~2026-05-31"/);
  assert.equal(calls, 12);
  assert.match(desktop, /最高 5月 · 5,000 token/);
});

test('bucket details list both the bucket and the whole range, with notes', () => {
  const activity = {
    pricingAsOf: '2026-11-20',
    days: [day(0, 4000), day(-2, 2000, { unpricedTokens: 50, unpricedModels: ['gpt-x'] })],
    history: { status: 'pending', coverageStart: iso(-29), days: [] }
  };
  const view = CARDS.buildView('year', activity, { now: NOW });
  const bucket = CARDS.selectedBucket(view, null);
  assert.equal(bucket.key, '2026-11-01~2026-11-23');
  assert.equal(bucket.totals.activeDays, 2);
  const html = CARDS.bucketDetailHtml(view, bucket, { lang: 'zh-CN' });
  assert.match(html, /2026年11月/);
  assert.match(html, /近 12 个月/);
  assert.match(html, /2\/23 天有用量/);
  assert.match(html, /正在整理更早的本地记录/);
  assert.match(html, /未定价型号/);
  assert.match(html, /11\/20 的公开牌价/);
  assert.match(html, /range-models/);
  assert.equal(CARDS.summaryText(bucket, 'zh-CN'), '2026年11月 · 6,000 token');
});

test('the weekly report shows last Monday to Sunday from the main process and compares with the week before', () => {
  const activity = {
    pricingAsOf: '2026-11-20',
    days: [day(0, 10)],
    history: { status: 'ready', coverageStart: iso(-60), days: [] },
    weeklyReport: sampleReport()
  };
  const view = CARDS.buildView('recap', activity, { now: NOW });
  assert.equal(view.range, 'recap');
  assert.equal(view.totals.tokens, 3000);
  assert.equal(view.todayTotals.tokens, 10);
  assert.deepEqual(view.buckets, []);
  assert.equal(view.change.kind, 'week');
  assert.equal(CARDS.changeInfo(view, 'zh-CN').title, '比前一周多 50%');
  assert.equal(CARDS.changeInfo(view, 'en-US').title, '50% more than the week before');
  assert.equal(CARDS.statLabel(view, 'zh-CN'), '上周已使用');
  assert.equal(CARDS.summaryText(null, 'zh-CN', view), '上周 11/16–11/22 · 3,000 token');

  const html = CARDS.chartHtml(view, { lang: 'zh-CN', skin: 'mobile' });
  assert.match(html, /class="token-recap" role="group" aria-label="上周回顾（周一至周日） · 11\/16–11\/22"/);
  assert.equal((html.match(/<div><dt>/g) || []).length, 5);
  assert.match(html, /最忙的一天<\/dt><dd><span class="recap-text">周四 11\/19 · 1,500 token/);
  assert.match(html, /range-dot series-1" aria-hidden="true"><\/i><span>Opus 5\.5<\/span> <em>67%/);
  assert.match(html, /<span>Fable 5\.2<\/span> <em>20%/);
  assert.match(html, /<span>alpha<\/span> <em>60%<\/em><\/span><span class="recap-item"><span>beta<\/span> <em>30%/);
  assert.match(html, /剩 12% · 周六 21:10/);
  assert.match(html, /≈ \$12\.5 · 6 个会话 · 4\/7 天/);
  assert.equal(CARDS.chartHtml(view, { lang: 'zh-CN', skin: 'desktop' }), html, 'both skins share one recap');

  const detail = CARDS.bucketDetailHtml(view, null, { lang: 'zh-CN' });
  assert.match(detail, /读写 300/);
  assert.match(detail, /缓存命中率 96\.4%/);
  assert.match(detail, /高峰时段<\/dt><dd>14:00–15:00/);
  assert.match(detail, /6 个会话 · 4\/7 天有用量/);
  assert.match(detail, /range-models/);
  assert.match(detail, /class="project-breakdown"[^]*上周各项目[^]*alpha[^]*其他 3 个/);
  assert.match(detail, /折算 API 成本：上周 ≈ \$12\.5</);
  assert.match(detail, /另有 40 token 来自未定价型号/);
  assert.match(detail, /11\/20 的公开牌价/);

  // 本地记录没盖到前一周：不比
  const short = CARDS.buildView('recap', { ...activity, history: { status: 'ready', coverageStart: iso(-10), days: [] } }, { now: NOW });
  assert.equal(short.change, null);
});

test('the weekly report waits for the first refresh, and an empty week still lists its rows', () => {
  const missing = CARDS.buildView('recap', { days: [day(0, 10)] }, { now: NOW });
  assert.equal(missing.report, null);
  assert.equal(missing.totals.tokens, 0);
  assert.equal(CARDS.summaryText(null, 'zh-CN', missing), '上周');
  assert.match(CARDS.chartHtml(missing, { lang: 'zh-CN' }), /token-recap is-message[^]*下一次刷新后显示周报/);
  assert.match(CARDS.bucketDetailHtml(missing, null, { lang: 'en-US' }), /The weekly report shows up after the next refresh/);

  const quiet = CARDS.buildView('recap', {
    days: [],
    weeklyReport: sampleReport({ tokens: 0, ioTokens: 0, costUsd: 0, unpricedTokens: 0, sessions: 0, activeDays: 0, busiestDay: null, busiestHour: null, models: [], projects: [], previousTokens: 0, quotaLow: null })
  }, { now: NOW });
  const html = CARDS.chartHtml(quiet, { lang: 'en-US' });
  assert.equal((html.match(/<div><dt>/g) || []).length, 5);
  assert.equal((html.match(/<span class="recap-text">—<\/span>/g) || []).length, 3);
  assert.match(html, /No quota samples that week/);
  assert.match(html, /≈ \$0\.00 · 0 sessions · 0\/7 days/);
  assert.equal(quiet.change, null);
});

test('the day detail shows usage by hour and the five-hour windows that touched that day', () => {
  const hours = Array(24).fill(0);
  hours[9] = 100;
  hours[14] = 400;
  hours[15] = 50;
  const item = { day: '2026-11-22', hours };
  const start = new Date(2026, 10, 22).getTime();
  const windows = [
    { startAt: start + 10 * HOUR, endAt: start + 15 * HOUR, peak: 78 },
    // 跨过零点的窗口：只画这天里的那一段
    { startAt: start - 2 * HOUR, endAt: start + 3 * HOUR, peak: 20 },
    // 第二天的窗口：不算
    { startAt: start + 30 * HOUR, endAt: start + 35 * HOUR, peak: 50 }
  ];
  const html = CARDS.hoursHtml(item, { lang: 'zh-CN', windows });
  assert.equal((html.match(/class="hours-bar/g) || []).length, 24);
  assert.equal((html.match(/is-peak/g) || []).length, 1);
  assert.match(html, /hours-bar is-peak" style="height:100\.0%"/);
  assert.match(html, /高峰 14:00–15:00 · 400 token/);
  assert.equal((html.match(/class="hours-window"/g) || []).length, 2);
  assert.match(html, /left:0\.00%;width:12\.50%/);
  assert.match(html, /left:41\.67%;width:20\.83%/);
  assert.match(html, /class="hours-windows" title="22:00–03:00 用到 20% · 10:00–15:00 用到 78%">5 小时窗口 2 个 · 最高 78%（10:00–15:00）</);
  assert.match(html, /class="hours-window" title="10:00–15:00 用到 78%"/);
  assert.match(CARDS.hoursHtml(item, { lang: 'en-US', windows: windows.slice(0, 1) }), />5-hour window 10:00–15:00 · peaked at 78%</);

  // GPT 不限 5 小时额度：写「不限」，这一行照样占着，两个平台一样高
  const unlimited = CARDS.hoursHtml(item, { lang: 'en-US', windows: [], fiveHourUnlimited: true });
  assert.match(unlimited, /class="hours-windows"[^>]*>No 5-hour limit</);
  assert.equal((unlimited.match(/class="hours-window"/g) || []).length, 0);

  const many = Array.from({ length: 5 }, (_, index) => ({ startAt: start + index * 4 * HOUR, endAt: start + (index * 4 + 5) * HOUR, peak: index === 1 ? 60 : 10 }));
  assert.match(CARDS.hoursHtml(item, { lang: 'ja-JP', windows: many }), />5時間枠 5 件 · 最大 60%（04:00–09:00）</);

  const quiet = CARDS.hoursHtml({ day: '2026-11-21', hours: Array(24).fill(0) }, { lang: 'zh-CN' });
  assert.match(quiet, /按小时<\/span><b>这天没有用量/);
  assert.match(quiet, /这天没有 5 小时窗口的记录/);
  assert.match(CARDS.hoursHtml({ day: '2026-11-20', tokens: 0 }, { lang: 'zh-CN' }), /这天没有用量/, 'a day with no records still gets the strip');
  assert.equal(CARDS.hoursHtml({ day: '2026-11-21', tokens: 5 }, { lang: 'zh-CN' }), '', 'older payloads without hours draw nothing');
  assert.equal(CARDS.hourRange(23), '23:00–24:00');
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
  const html = CARDS.toggleHtml('recap', 'ja-JP', 'trend-range-button');
  assert.equal((html.match(/<button/g) || []).length, 4);
  assert.match(html, /data-token-range="week"[^>]*>7日<\/button>[^]*data-token-range="month"[^>]*>30日<\/button>[^]*data-token-range="year"[^>]*>1年<\/button>/);
  assert.match(html, /class="trend-range-button active" data-token-range="recap" aria-pressed="true">週報/);
  assert.equal(CARDS.normalizeRange('decade'), 'month');
  assert.equal(CARDS.statLabel(CARDS.buildView('year', {}, { now: NOW }), 'en-US'), '12-month used');
  assert.equal(CARDS.statLabel(CARDS.buildView('recap', {}, { now: NOW }), 'zh-CN'), '上周已使用');
  assert.equal(CARDS.rangeLabel('recap', 'en-US'), 'Recap');
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
