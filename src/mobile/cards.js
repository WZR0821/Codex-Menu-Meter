// 两端共用的卡片渲染（2.0.0）：Token 活动的 7 天 / 90 天 / 1 年柱状图、和上一段的对比、
// 分组明细（读写、命中率、活跃天数、按模型、费用），以及额度卡下面的「额度去向」。
// 桌面面板（src/renderer.js）和手机页（src/mobile/mobile.js）都调这一份；这些新卡片的文案也在这里，
// 三种语言各一份，两边看到的字和数一样。两边只是类名不同（skin），结构和计算完全一样。
// 测试在 test/cards.test.js。
(function (global, factory) {
  const week = (global && global.CMM_TOKEN_WEEK)
    || (typeof require === 'function' ? require('./token-week.js') : null);
  const api = factory(week);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.CMM_CARDS = api;
})(typeof window !== 'undefined' ? window : null, function (TOKEN_WEEK) {
  'use strict';

  const LOCALES = ['zh-CN', 'en-US', 'ja-JP'];
  const RANGES = ['week', 'month', 'quarter', 'year'];
  const DEFAULT_RANGE = 'month';
  // 7 天、30 天、90 天按天数；1 年是 12 个自然月（本月算到今天）。
  const RANGE_DAYS = { week: 7, month: 30, quarter: 90 };
  const QUARTER_BUCKET_DAYS = 7;
  const YEAR_MONTHS = 12;
  // 柱子多时只隔几根标一个日期（从最右一根往左数），其余留空，免得字挤在一起。
  const LABEL_EVERY = { week: 1, quarter: 3, year: 2 };
  // 额度去向：已用不到 1% 时换算出的「1% ≈」误差太大，不给数字。
  const ATTRIBUTION_MIN_USED = 1;
  // 固定三行（前两个项目 + 其他），不够的留空行：GPT 和 Claude 切换时这一块一样高。
  const ATTRIBUTION_ROWS = 3;

  const TEXT = {
    rangeWeek: ['7 天', '7d', '7日'],
    rangeMonth: ['30 天', '30d', '30日'],
    rangeQuarter: ['90 天', '90d', '90日'],
    rangeYear: ['1 年', '1y', '1年'],
    usedDays: ['近 {n} 天已使用', '{n}-day used', '直近{n}日の使用量'],
    usedYear: ['近 12 个月已使用', '12-month used', '直近12か月の使用量'],
    nameDays: ['近 {n} 天', 'Last {n} days', '直近{n}日'],
    nameYear: ['近 12 个月', 'Last 12 months', '直近12か月'],
    changeMore: ['比前 {n} 天多 {v}', '{v} more than the previous {n} days', '前の{n}日より {v} 多い'],
    changeLess: ['比前 {n} 天少 {v}', '{v} less than the previous {n} days', '前の{n}日より {v} 少ない'],
    changeSame: ['和前 {n} 天差不多', 'About the same as the previous {n} days', '前の{n}日とほぼ同じ'],
    changeFlat: ['持平', 'flat', '横ばい'],
    chartAriaWeek: ['近 7 天每日用量，按模型分色', 'Daily usage for the last 7 days, colored by model', '直近7日の日別使用量（モデル別に色分け）'],
    chartAriaQuarter: ['近 90 天每周用量，按模型分色', 'Weekly usage for the last 90 days, colored by model', '直近90日の週別使用量（モデル別に色分け）'],
    chartAriaYear: ['近 12 个月每月用量，按模型分色', 'Monthly usage for the last 12 months, colored by model', '直近12か月の月別使用量（モデル別に色分け）'],
    modelOther: ['其他', 'Other', 'その他'],
    modelUnknown: ['未知型号', 'unknown model', '不明なモデル'],
    usedAmount: ['已使用 {v}', 'Used {v}', '使用済み {v}'],
    ioAmount: ['读写 {v}', 'I/O {v}', '読み書き {v}'],
    cacheHit: ['缓存命中率 {v}', 'Cache hit {v}', 'キャッシュヒット率 {v}'],
    activeDays: ['{n}/{total} 天有用量', 'Active {n} of {total} days', '{total}日中{n}日利用'],
    costRange: [
      '折算 API 成本：{bucket} ≈ {bucketCost} · {range} ≈ {rangeCost}',
      'Est. API cost: {bucket} ≈ {bucketCost} · {range} ≈ {rangeCost}',
      'API 換算コスト：{bucket} ≈ {bucketCost} · {range} ≈ {rangeCost}'
    ],
    costUnpriced: ['另有 {v} 来自未定价型号（{models}），未计入费用', '{v} from unpriced models ({models}) not included', '料金未公開のモデル（{models}）の {v} は含みません'],
    costHint: [
      '按各模型 {date} 的公开牌价估算（输入、输出、5 分钟/1 小时缓存写、缓存读分别计价），订阅已覆盖',
      'Estimated from list prices as of {date} (input, output, 5-min/1-hour cache writes and cache reads priced separately); covered by your subscription',
      '{date} 時点の公開料金で概算（入力・出力・5 分/1 時間キャッシュ書き込み・読み取りを個別計算）。サブスクリプションでカバー済み'
    ],
    historyPending: ['正在整理更早的本地记录，稍后补全', 'Still reading older local logs — this fills in shortly', '過去のローカル記録を集計中です。まもなく反映されます'],
    historyFrom: ['本地记录从 {date} 开始，更早的显示为空', 'Local records start on {date}; earlier bars are empty', 'ローカル記録は {date} から。それ以前は空欄です'],
    attrTitle: ['额度去向 · 本周', 'Where this week went', '今週の使い道'],
    attrEstimate: ['估算', 'est.', '推定'],
    attrPerPoint: ['1% ≈ {usd} · {tokens}', '1% ≈ {usd} · {tokens}', '1% ≈ {usd} · {tokens}'],
    attrOther: ['其他 {n} 个', '{n} more', 'ほか {n} 件'],
    attrUnknown: ['未知目录', 'Unknown folder', '不明なフォルダ'],
    attrNote: [
      '按 Mac 本地日志的 API 等价费用折算；网页和其他设备的用量不在其中',
      'Scaled from local logs on your Mac at API prices; web and other devices aren’t included',
      'Mac のローカルログを API 料金で換算。Web や他の端末の分は含みません'
    ],
    attrTooLittle: ['本周用量还太少，暂不估算', 'Too little usage this week to estimate', '今週はまだ推定できるほど使っていません'],
    attrAria: ['本周各项目约占的周额度', 'Estimated share of the weekly quota by project', '今週の週間枠に占めるプロジェクト別の推定割合']
  };

  const RANGE_LABEL_KEYS = { week: 'rangeWeek', month: 'rangeMonth', quarter: 'rangeQuarter', year: 'rangeYear' };

  // 两端的柱状图结构一样、类名不同：桌面沿用 1.1.0 的 token-week-*，手机沿用 week-*。
  const SKINS = {
    desktop: {
      root: 'token-week',
      legend: 'token-week-legend',
      key: 'token-week-key',
      dot: 'token-series-dot',
      plot: 'token-week-plot',
      col: 'token-week-col',
      track: 'token-week-track',
      bar: 'token-week-bar',
      seg: 'token-week-seg',
      label: 'token-week-day',
      selected: 'selected',
      tag: 'span',
      colsVar: '--token-week-cols'
    },
    mobile: {
      root: 'week-chart',
      legend: 'week-legend',
      key: 'week-key',
      dot: 'series-dot',
      plot: 'week-plot',
      col: 'week-col',
      track: 'week-track',
      bar: 'week-bar',
      seg: 'week-seg',
      label: 'week-day',
      selected: 'active',
      tag: 'button',
      colsVar: '--week-cols'
    }
  };

  function locale(lang) {
    return LOCALES.includes(lang) ? lang : LOCALES[0];
  }

  function text(lang, key, params) {
    const entry = TEXT[key];
    if (!entry) return key;
    let value = entry[LOCALES.indexOf(locale(lang))] ?? entry[0];
    if (params) {
      for (const [name, replacement] of Object.entries(params)) value = value.split(`{${name}}`).join(String(replacement));
    }
    return value;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function num(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // 和桌面 src/i18n.js 的 formatTokenCount、手机 formatTokens 同一套写法。
  function formatTokens(lang, value, withUnit = true) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    const code = locale(lang);
    if (code === 'en-US') {
      const unit = withUnit ? ' tokens' : '';
      if (number >= 1e9) return `${(number / 1e9).toFixed(2)}B${unit}`;
      if (number >= 1e6) return `${(number / 1e6).toFixed(2)}M${unit}`;
      if (number >= 1e4) return `${(number / 1e3).toFixed(1)}K${unit}`;
      return `${new Intl.NumberFormat('en-US').format(Math.round(number))}${unit}`;
    }
    const unit = withUnit ? ' token' : '';
    const hundredMillion = code === 'ja-JP' ? '億' : '亿';
    if (number >= 1e8) return `${(number / 1e8).toFixed(2)} ${hundredMillion}${unit}`;
    if (number >= 1e4) return `${(number / 1e4).toFixed(2)} 万${unit}`;
    return `${new Intl.NumberFormat('en-US').format(Math.round(number))}${unit}`;
  }

  function formatUsd(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '$0';
    if (number >= 100) return `$${Math.round(number)}`;
    if (number >= 10) return `$${number.toFixed(1)}`;
    return `$${number.toFixed(2)}`;
  }

  function cacheHitPercent(cachedInputTokens, inputTokens) {
    if (cachedInputTokens === null || cachedInputTokens === undefined || inputTokens === null || inputTokens === undefined) return null;
    const cached = Number(cachedInputTokens);
    const input = Number(inputTokens);
    if (!Number.isFinite(cached) || !Number.isFinite(input) || input <= 0) return null;
    return clamp((cached / input) * 100, 0, 100);
  }

  function formatCacheHit(lang, cachedInputTokens, inputTokens) {
    const rate = cacheHitPercent(cachedInputTokens, inputTokens);
    if (rate === null) return '--';
    return `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 1 }).format(rate)}%`;
  }

  // 按显示出来的那个数（保留 1 位小数）判色：≥97% 绿、93–97% 黄、<93% 红，和 renderer.js、mobile.js 里的同名函数一致。
  function cacheHitTone(cachedInputTokens, inputTokens) {
    const rate = cacheHitPercent(cachedInputTokens, inputTokens);
    if (rate === null) return 'cache-hit-neutral';
    const shown = Math.round(rate * 10) / 10;
    if (shown >= 97) return 'cache-hit-good';
    if (shown >= 93) return 'cache-hit-warning';
    return 'cache-hit-critical';
  }

  // ---- 日期（一律按本地时区的自然日） ----

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function isIsoDay(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function parseDay(day) {
    const [year, month, date] = String(day).split('-').map(Number);
    return new Date(year, month - 1, date);
  }

  function addDays(date, count) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function shortDay(day) {
    const [, month, date] = String(day).split('-');
    return `${Number(month)}/${Number(date)}`;
  }

  function monthShort(lang, day) {
    return new Intl.DateTimeFormat(locale(lang), { month: 'short' }).format(parseDay(day));
  }

  function monthTitle(lang, day) {
    return new Intl.DateTimeFormat(locale(lang), { year: 'numeric', month: 'short' }).format(parseDay(day));
  }

  // ---- 数据：把近 30 天（按日志现算）和更早的日汇总（落盘的）拼成一张按天的表 ----

  function normalizeRange(value) {
    return RANGES.includes(value) ? value : DEFAULT_RANGE;
  }

  function nullableCount(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : null;
  }

  function normalizeDay(source) {
    return {
      day: source.day,
      tokens: num(source.tokens ?? source.value),
      ioTokens: num(source.ioTokens),
      inputTokens: nullableCount(source.inputTokens),
      cachedInputTokens: nullableCount(source.cachedInputTokens),
      costUsd: num(source.costUsd),
      unpricedTokens: num(source.unpricedTokens),
      unpricedModels: Array.isArray(source.unpricedModels) ? source.unpricedModels.map(String) : [],
      threads: num(source.threads),
      models: Array.isArray(source.models)
        ? source.models
          .filter((model) => model && model.model)
          .map((model) => ({
            model: String(model.model),
            value: TOKEN_WEEK.modelTokens(model),
            costUsd: Number.isFinite(Number(model.costUsd)) && model.costUsd !== null ? Number(model.costUsd) : null
          }))
        : []
    };
  }

  function collectDays(activity) {
    const days = new Map();
    for (const source of activity?.history?.days || []) {
      if (isIsoDay(source?.day)) days.set(source.day, normalizeDay(source));
    }
    // 近 30 天以按日志现算的为准（带项目拆分、未来格子不算）。
    for (const source of activity?.days || []) {
      if (isIsoDay(source?.day) && !source.future) days.set(source.day, normalizeDay(source));
    }
    return days;
  }

  function roundCents(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  // [from, to] 两头都含。没记录的天算 0（但算进 dayCount）。
  function sumRange(days, from, to) {
    const totals = {
      tokens: 0,
      ioTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      hasCacheMetrics: false,
      costUsd: 0,
      unpricedTokens: 0,
      threads: 0,
      activeDays: 0,
      dayCount: 0
    };
    const unpricedModels = new Set();
    const models = new Map();
    for (let date = startOfDay(from); date <= to; date = addDays(date, 1)) {
      totals.dayCount += 1;
      const day = days.get(isoDate(date));
      if (!day) continue;
      totals.tokens += day.tokens;
      totals.ioTokens += day.ioTokens;
      if (day.inputTokens !== null && day.cachedInputTokens !== null) {
        totals.inputTokens += day.inputTokens;
        totals.cachedInputTokens += day.cachedInputTokens;
        totals.hasCacheMetrics = true;
      }
      totals.costUsd += day.costUsd;
      totals.unpricedTokens += day.unpricedTokens;
      totals.threads += day.threads;
      if (day.tokens > 0) totals.activeDays += 1;
      for (const model of day.unpricedModels) unpricedModels.add(model);
      for (const model of day.models) {
        const item = models.get(model.model) || { model: model.model, value: 0, costUsd: 0, priced: true };
        item.value += model.value;
        if (model.costUsd === null) item.priced = false;
        else item.costUsd += model.costUsd;
        models.set(model.model, item);
      }
    }
    return {
      ...totals,
      inputTokens: totals.hasCacheMetrics ? totals.inputTokens : null,
      cachedInputTokens: totals.hasCacheMetrics ? totals.cachedInputTokens : null,
      costUsd: roundCents(totals.costUsd),
      unpricedModels: [...unpricedModels],
      models: [...models.values()]
        .sort((left, right) => right.value - left.value || left.model.localeCompare(right.model))
        .map((item) => ({ model: item.model, value: item.value, costUsd: item.priced ? roundCents(item.costUsd) : null }))
    };
  }

  function makeBucket(days, start, end, kind) {
    const startDay = isoDate(start);
    const endDay = isoDate(end);
    return {
      key: kind === 'day' ? startDay : `${startDay}~${endDay}`,
      kind,
      start: startDay,
      end: endDay,
      totals: sumRange(days, start, end)
    };
  }

  // 一个时间范围的全部数字：柱子（分组）、合计、和上一段的对比、记录从哪天开始有。
  // 30 天视图没有柱子（两端各画自己的热力图），其余三种的分组：
  // 7 天 = 每天一根；90 天 = 从今天往回每 7 天一根，共 13 根（最早那根 6 天，合起来正好 90 天）；
  // 1 年 = 12 个自然月，本月只算到今天。对比只在上一段完全有记录时给：本地记录最早一天不晚于上一段开头，
  // 且上一段确实有用量；1 年视图不对比。
  function buildView(range, activity, { now = new Date() } = {}) {
    const key = normalizeRange(range);
    const days = collectDays(activity);
    const today = startOfDay(now);
    const history = activity?.history && typeof activity.history === 'object' ? activity.history : null;
    const firstLiveDay = (activity?.days || []).map((day) => day?.day).filter(isIsoDay).sort()[0] || null;
    const coverageStart = isIsoDay(history?.coverageStart) ? history.coverageStart : firstLiveDay;
    const buckets = [];
    let rangeStart;
    let previous = null;
    if (key === 'year') {
      rangeStart = new Date(today.getFullYear(), today.getMonth() - (YEAR_MONTHS - 1), 1);
      for (let index = 0; index < YEAR_MONTHS; index += 1) {
        const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + index, 1);
        const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        buckets.push(makeBucket(days, start, monthEnd > today ? today : monthEnd, 'month'));
      }
    } else {
      const length = RANGE_DAYS[key];
      rangeStart = addDays(today, -(length - 1));
      previous = { start: addDays(today, -(2 * length - 1)), end: addDays(today, -length), days: length };
      if (key === 'week') {
        for (let index = 0; index < length; index += 1) {
          const date = addDays(rangeStart, index);
          buckets.push(makeBucket(days, date, date, 'day'));
        }
      } else if (key === 'quarter') {
        for (let end = today; end >= rangeStart; end = addDays(end, -QUARTER_BUCKET_DAYS)) {
          const start = addDays(end, -(QUARTER_BUCKET_DAYS - 1));
          buckets.unshift(makeBucket(days, start < rangeStart ? rangeStart : start, end, 'week'));
        }
      }
    }
    const totals = sumRange(days, rangeStart, today);
    let change = null;
    if (previous) {
      const prior = sumRange(days, previous.start, previous.end);
      if (coverageStart && coverageStart <= isoDate(previous.start) && prior.tokens > 0) {
        change = { ratio: totals.tokens / prior.tokens - 1, days: previous.days, previousTokens: prior.tokens };
      }
    }
    return {
      range: key,
      today: isoDate(today),
      rangeStart: isoDate(rangeStart),
      dayCount: totals.dayCount,
      totals,
      change,
      buckets,
      coverageStart,
      historyStatus: history ? (history.status === 'ready' ? 'ready' : 'pending') : null,
      pricingAsOf: isIsoDay(activity?.pricingAsOf) ? activity.pricingAsOf : null,
      todayTotals: sumRange(days, today, today)
    };
  }

  function selectedBucket(view, key) {
    return view.buckets.find((bucket) => bucket.key === key) || view.buckets[view.buckets.length - 1] || null;
  }

  // ---- 文字 ----

  function rangeLabel(range, lang) {
    return text(lang, RANGE_LABEL_KEYS[normalizeRange(range)]);
  }

  function statLabel(view, lang) {
    return view.range === 'year' ? text(lang, 'usedYear') : text(lang, 'usedDays', { n: RANGE_DAYS[view.range] });
  }

  function rangeName(view, lang) {
    return view.range === 'year' ? text(lang, 'nameYear') : text(lang, 'nameDays', { n: RANGE_DAYS[view.range] });
  }

  function bucketTitle(bucket, lang) {
    if (!bucket) return '';
    if (bucket.kind === 'month') return monthTitle(lang, bucket.start);
    if (bucket.kind === 'week') return bucket.start === bucket.end ? shortDay(bucket.start) : `${shortDay(bucket.start)}–${shortDay(bucket.end)}`;
    return shortDay(bucket.start);
  }

  function bucketAxisLabel(bucket, lang) {
    return bucket.kind === 'month' ? monthShort(lang, bucket.start) : shortDay(bucket.start);
  }

  function summaryText(bucket, lang) {
    return `${bucketTitle(bucket, lang)} · ${formatTokens(lang, bucket?.totals?.tokens || 0)}`;
  }

  function modelLabel(name, lang) {
    if (!name || name === '?') return text(lang, 'modelUnknown');
    return TOKEN_WEEK.formatModelName(name) || text(lang, 'modelUnknown');
  }

  function changeInfo(view, lang) {
    const change = view?.change;
    if (!change) return null;
    const percent = Math.round(Math.abs(change.ratio) * 100);
    const direction = percent === 0 ? 'flat' : change.ratio > 0 ? 'up' : 'down';
    const shown = percent > 999 ? '999%+' : `${percent}%`;
    return {
      direction,
      short: direction === 'flat' ? text(lang, 'changeFlat') : `${direction === 'up' ? '↑' : '↓'}${shown}`,
      title: direction === 'flat'
        ? text(lang, 'changeSame', { n: change.days })
        : text(lang, direction === 'up' ? 'changeMore' : 'changeLess', { n: change.days, v: shown })
    };
  }

  // 放在合计标题那一行的末尾，不另占一行，所以卡片高度不变。颜色不分好坏（用得多不一定是坏事）。
  function changeHtml(view, lang) {
    const info = changeInfo(view, lang);
    if (!info) return '';
    return `<em class="range-change ${info.direction}" title="${escapeHtml(info.title)}" aria-label="${escapeHtml(info.title)}">${escapeHtml(info.short)}</em>`;
  }

  function toggleHtml(active, lang, buttonClass) {
    const current = normalizeRange(active);
    return RANGES.map((range) => `<button type="button" class="${buttonClass}${range === current ? ' active' : ''}" data-token-range="${range}" aria-pressed="${range === current}">${escapeHtml(rangeLabel(range, lang))}</button>`).join('');
  }

  // ---- 柱状图 ----

  function pseudoDay(bucket) {
    return { tokens: bucket.totals.tokens, models: bucket.totals.models };
  }

  // 配色按整个范围的合计排名一次性分号（前三个模型各一色，其余灰色「其他」），图例、柱子、明细同一套。
  function seriesFor(view) {
    return TOKEN_WEEK.weekSeries(view.buckets.map(pseudoDay));
  }

  // 稀疏标注：从最右一根往左每 every 根标一个；选中的那根一定标出来，紧挨着它的标注让开，免得重叠。
  function labelVisibility(count, every, selectedIndex) {
    const visible = Array.from({ length: count }, (_, index) => (count - 1 - index) % every === 0);
    if (every > 1 && selectedIndex >= 0 && selectedIndex < count && !visible[selectedIndex]) {
      visible[selectedIndex] = true;
      if (selectedIndex > 0) visible[selectedIndex - 1] = false;
      if (selectedIndex < count - 1) visible[selectedIndex + 1] = false;
    }
    return visible;
  }

  function chartAriaKey(range) {
    if (range === 'quarter') return 'chartAriaQuarter';
    if (range === 'year') return 'chartAriaYear';
    return 'chartAriaWeek';
  }

  // columnAttrs(row) 给每根柱子补额外的属性（桌面用它挂悬停提示的数据），返回已转义好的属性串。
  function chartHtml(view, { lang, skin = 'desktop', selectedKey = null, series = null, columnAttrs = null } = {}) {
    if (!view?.buckets?.length) return '';
    const names = SKINS[skin] || SKINS.desktop;
    const colors = series || seriesFor(view);
    const rows = view.buckets.map((bucket) => {
      const segments = TOKEN_WEEK.weekSegments(pseudoDay(bucket), colors);
      return { bucket, segments, total: segments.reduce((sum, segment) => sum + segment.value, 0) };
    });
    const heights = TOKEN_WEEK.barHeights(rows);
    const found = rows.findIndex((row) => row.bucket.key === selectedKey);
    const selectedIndex = found >= 0 ? found : rows.length - 1;
    const every = LABEL_EVERY[view.range] || 1;
    const visible = labelVisibility(rows.length, every, selectedIndex);
    const legend = [
      ...colors.named.map((name, index) => ({ slot: index + 1, label: modelLabel(name, lang) })),
      ...(colors.hasOther ? [{ slot: 'other', label: text(lang, 'modelOther') }] : [])
    ];
    const interactive = names.tag === 'button' ? 'type="button"' : 'tabindex="0" role="button"';
    return `
    <div class="${names.root}" role="group" aria-label="${escapeHtml(text(lang, chartAriaKey(view.range)))}">
      <div class="${names.legend}">
        ${legend.map((item) => `<span class="${names.key}" title="${escapeHtml(item.label)}"><i class="${names.dot} series-${item.slot}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></span>`).join('')}
      </div>
      <div class="${names.plot}${every > 1 ? ' sparse' : ''}" style="${names.colsVar}:${rows.length}">
        ${rows.map((row, index) => {
          const { bucket, segments } = row;
          const selected = index === selectedIndex;
          const title = bucket.kind === 'day' ? bucket.start : bucketTitle(bucket, lang);
          const aria = `${bucket.kind === 'day' ? shortDay(bucket.start) : title} · ${formatTokens(lang, bucket.totals.tokens)}`;
          const dataKey = bucket.kind === 'day' ? `data-day="${escapeHtml(bucket.key)}"` : `data-bucket="${escapeHtml(bucket.key)}"`;
          const extra = typeof columnAttrs === 'function' ? ` ${columnAttrs({ bucket, segments, series: colors, index })}` : '';
          return `
          <${names.tag} class="${names.col}${selected ? ` ${names.selected}` : ''}" ${interactive} aria-pressed="${selected}" ${dataKey} data-title="${escapeHtml(title)}" aria-label="${escapeHtml(aria)}"${extra}>
            <span class="${names.track}"><span class="${names.bar}" style="height:${heights[index].toFixed(1)}%;--i:${index}">${segments.map((segment) => `<i class="${names.seg} series-${segment.slot}" style="flex-grow:${segment.value}"></i>`).join('')}</span></span>
            <span class="${names.label}${visible[index] ? '' : ' is-blank'}">${escapeHtml(bucketAxisLabel(bucket, lang))}</span>
          </${names.tag}>`;
        }).join('')}
      </div>
    </div>
  `;
  }

  // 柱子悬停提示里的按模型拆分（桌面用）：带上序列号，提示里的圆点和柱子同色。
  function tooltipModels(bucket, series) {
    return bucket.totals.models
      .filter((model) => model.model && model.value > 0)
      .map((model) => ({ model: model.model, value: model.value, slot: series.slots.get(model.model) || 'other' }));
  }

  // ---- 明细 ----

  // 所选一段的按模型拆分：圆点颜色和柱子一致，数字用正文色。
  function modelsHtml(totals, { lang, series = null } = {}) {
    const day = { tokens: totals?.tokens || 0, models: totals?.models || [] };
    if (!(day.tokens > 0)) return '';
    const colors = series || TOKEN_WEEK.weekSeries([day]);
    const segments = TOKEN_WEEK.weekSegments(day, colors);
    if (!segments.length) return '';
    const names = new Map(colors.named.map((name, index) => [index + 1, modelLabel(name, lang)]));
    return `
    <ul class="range-models">
      ${segments.map((segment) => {
        const share = Math.round((segment.value / day.tokens) * 1000) / 10;
        return `<li><i class="range-dot series-${segment.slot}" aria-hidden="true"></i><span>${escapeHtml(names.get(segment.slot) || text(lang, 'modelOther'))}</span><em>${escapeHtml(`${share}%`)}</em><b>${escapeHtml(formatTokens(lang, segment.value))}</b></li>`;
      }).join('')}
    </ul>
  `;
  }

  function historyNote(view, lang) {
    if (view.historyStatus === 'pending') return text(lang, 'historyPending');
    if (view.coverageStart && view.coverageStart > view.rangeStart) return text(lang, 'historyFrom', { date: shortDay(view.coverageStart) });
    return '';
  }

  function unpricedNote(totals, lang) {
    if (!(totals.unpricedTokens > 0)) return '';
    return text(lang, 'costUnpriced', {
      v: formatTokens(lang, totals.unpricedTokens),
      models: totals.unpricedModels.slice(0, 2).map((model) => modelLabel(model, lang)).join(' / ')
    });
  }

  function metricHtml(label, value, tone = '') {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${tone ? `<span class="cache-hit-rate ${tone}">${escapeHtml(value)}</span>` : escapeHtml(value)}</dd></div>`;
  }

  // 90 天 / 1 年视图下「统计详情」展开后的内容：所选那一段和整个范围的读写、命中率，所选那一段的活跃天数、
  // 按模型拆分和费用。这些天的日汇总里没有项目拆分，所以不列项目。
  function bucketDetailHtml(view, bucket, { lang, series = null } = {}) {
    if (!bucket) return '';
    const name = bucketTitle(bucket, lang);
    const whole = rangeName(view, lang);
    const own = bucket.totals;
    const all = view.totals;
    const notes = [
      text(lang, 'costRange', { bucket: name, bucketCost: formatUsd(own.costUsd), range: whole, rangeCost: formatUsd(all.costUsd) }),
      unpricedNote(all, lang),
      historyNote(view, lang),
      view.pricingAsOf ? text(lang, 'costHint', { date: shortDay(view.pricingAsOf) }) : ''
    ].filter(Boolean);
    return `
      <dl class="detail-metrics">
        ${metricHtml(name, text(lang, 'ioAmount', { v: formatTokens(lang, own.ioTokens, false) }))}
        ${metricHtml(whole, text(lang, 'ioAmount', { v: formatTokens(lang, all.ioTokens, false) }))}
        ${metricHtml(name, text(lang, 'cacheHit', { v: formatCacheHit(lang, own.cachedInputTokens, own.inputTokens) }))}
        ${metricHtml(whole, text(lang, 'cacheHit', { v: formatCacheHit(lang, all.cachedInputTokens, all.inputTokens) }))}
        ${metricHtml(name, text(lang, 'activeDays', { n: own.activeDays, total: own.dayCount }))}
      </dl>
      ${modelsHtml(own, { lang, series: series || seriesFor(view) })}
      ${notes.map((note) => `<p class="detail-note">${escapeHtml(note)}</p>`).join('')}
    `;
  }

  // ---- 额度去向 ----

  // 用周额度已用的百分比和同一窗口里本机记录的等价费用对上：1% ≈ 费用 / 已用%，
  // 某个项目约占 已用% × 它的费用 / 总费用。只有本机日志，所以界面上标「估算」。
  function attributionModel(windowValue, activityWindow) {
    const attribution = activityWindow?.attribution;
    if (!windowValue || windowValue.inactive || !attribution || typeof attribution !== 'object') return null;
    const used = Number.isFinite(Number(windowValue.usedPercent)) && windowValue.usedPercent !== null
      ? Number(windowValue.usedPercent)
      : 100 - Number(windowValue.remainingPercent);
    if (!Number.isFinite(used)) return null;
    const usedPercent = clamp(used, 0, 100);
    const costUsd = num(attribution.costUsd);
    const ready = usedPercent >= ATTRIBUTION_MIN_USED && costUsd > 0;
    const projects = Array.isArray(attribution.projects) ? attribution.projects.filter((row) => row && typeof row === 'object') : [];
    const named = projects.filter((row) => !(Number(row.other) > 0)).slice(0, ATTRIBUTION_ROWS - 1);
    const rest = projects.filter((row) => !named.includes(row));
    const rows = named.map((row) => ({ name: row.name ? String(row.name) : null, other: 0, costUsd: num(row.costUsd), tokens: num(row.tokens) }));
    if (rest.length) {
      rows.push({
        name: null,
        other: rest.reduce((count, row) => count + (Number(row.other) > 0 ? Number(row.other) : 1), 0),
        costUsd: rest.reduce((sum, row) => sum + num(row.costUsd), 0),
        tokens: rest.reduce((sum, row) => sum + num(row.tokens), 0)
      });
    }
    for (const row of rows) row.points = ready ? (usedPercent * row.costUsd) / costUsd : 0;
    return {
      usedPercent,
      ready,
      costUsd,
      perPointUsd: ready ? costUsd / usedPercent : null,
      tokensPerPoint: ready ? num(attribution.pricedTokens) / usedPercent : null,
      rows
    };
  }

  function formatPoints(points) {
    if (!(points > 0)) return '0%';
    if (points < 0.1) return '<0.1%';
    return `≈${points >= 10 ? Math.round(points) : (Math.round(points * 10) / 10)}%`;
  }

  // 一整块接在两张额度卡下面，跟着标题行的「使用明细」按钮一起展开、收起（同一个 data-detail）。
  // 固定三行：项目不够时留空行，用量太少时第一行写原因，GPT 和 Claude 这一块一样高。
  function attributionHtml(model, { lang } = {}) {
    if (!model) return '';
    const rows = [];
    for (let index = 0; index < ATTRIBUTION_ROWS; index += 1) {
      const row = model.ready ? model.rows[index] : null;
      if (!model.ready && index === 0) {
        rows.push(`<li class="attribution-row is-message"><span>${escapeHtml(text(lang, 'attrTooLittle'))}</span></li>`);
        continue;
      }
      if (!row) {
        rows.push('<li class="attribution-row is-empty" aria-hidden="true"><span class="attribution-name">&nbsp;</span></li>');
        continue;
      }
      const name = row.other > 0 ? text(lang, 'attrOther', { n: row.other }) : (row.name || text(lang, 'attrUnknown'));
      const width = clamp(row.points, 0, 100);
      rows.push(`<li class="attribution-row" title="${escapeHtml(`${name} · ${formatUsd(row.costUsd)} · ${formatTokens(lang, row.tokens)}`)}">
          <span class="attribution-name">${escapeHtml(name)}</span>
          <span class="attribution-bar" aria-hidden="true"><i style="width:${Math.max(1.5, width).toFixed(1)}%"></i></span>
          <b>${escapeHtml(formatPoints(row.points))}</b>
          <small>${escapeHtml(formatUsd(row.costUsd))}</small>
        </li>`);
    }
    const perPoint = model.ready
      ? text(lang, 'attrPerPoint', { usd: formatUsd(model.perPointUsd), tokens: formatTokens(lang, model.tokensPerPoint) })
      : '';
    return `
    <details class="quota-activity quota-attribution inline-details" data-detail="quota-activity">
      <summary><span>${escapeHtml(text(lang, 'attrTitle'))}</span></summary>
      <div class="disclosure-content">
        <div class="attribution-head">
          <span>${escapeHtml(text(lang, 'attrTitle'))}<em>${escapeHtml(text(lang, 'attrEstimate'))}</em></span>
          <b>${escapeHtml(perPoint)}</b>
        </div>
        <ul class="attribution-rows" aria-label="${escapeHtml(text(lang, 'attrAria'))}">
          ${rows.join('')}
        </ul>
        <p class="attribution-note">${escapeHtml(text(lang, 'attrNote'))}</p>
      </div>
    </details>
  `;
  }

  return {
    LOCALES,
    RANGES,
    RANGE_DAYS,
    SKINS,
    TEXT,
    text,
    escapeHtml,
    formatTokens,
    formatUsd,
    formatCacheHit,
    cacheHitTone,
    isoDate,
    shortDay,
    normalizeRange,
    collectDays,
    sumRange,
    buildView,
    selectedBucket,
    rangeLabel,
    statLabel,
    rangeName,
    bucketTitle,
    summaryText,
    changeInfo,
    changeHtml,
    toggleHtml,
    seriesFor,
    labelVisibility,
    chartHtml,
    tooltipModels,
    modelsHtml,
    historyNote,
    bucketDetailHtml,
    attributionModel,
    formatPoints,
    attributionHtml
  };
});
