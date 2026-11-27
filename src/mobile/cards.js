// 两端共用的卡片渲染（2.0.0）：Token 活动的 7 天柱状图、1 年折线、上周的周报、和上一段的对比、
// 分组明细（读写、命中率、活跃天数、按模型、费用）、单日明细里的按小时分布，以及额度卡下面的「额度去向」。
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
  // 「周报」占了原来 90 天的位置（2.0.0 发布前用户说 90 天不需要），切换按钮仍是四段，卡片尺寸不变。
  const RANGES = ['week', 'month', 'year', 'recap'];
  const DEFAULT_RANGE = 'month';
  // 7 天、30 天按天数；1 年是 12 个自然月（本月算到今天）；周报是上一个完整的自然周（主进程算好，见 src/usage-recap.js）。
  const RANGE_DAYS = { week: 7, month: 30 };
  const YEAR_MONTHS = 12;
  // 1 年折线的月份刻度隔一个写一个（从最右往左数），选中的月份一定写出来。
  const YEAR_LABEL_EVERY = 2;
  // 1 年折线的最高点画在这个高度（百分比），上面留出圆点的位置。
  const LINE_TOP = 84;
  // 额度去向：已用不到 1% 时换算出的「1% ≈」误差太大，不给数字。
  const ATTRIBUTION_MIN_USED = 1;
  // 固定三行（前两个项目 + 其他），不够的留空行：GPT 和 Claude 切换时这一块一样高。
  const ATTRIBUTION_ROWS = 3;

  const TEXT = {
    rangeWeek: ['7 天', '7d', '7日'],
    rangeMonth: ['30 天', '30d', '30日'],
    rangeYear: ['1 年', '1y', '1年'],
    // 英文原来是 Weekly：四段按最宽的一段等分，太长会把手机上的标题挤掉（2.1.0 改短）。
    rangeRecap: ['周报', 'Recap', '週報'],
    usedDays: ['近 {n} 天已使用', '{n}-day used', '直近{n}日の使用量'],
    usedYear: ['近 12 个月已使用', '12-month used', '直近12か月の使用量'],
    nameDays: ['近 {n} 天', 'Last {n} days', '直近{n}日'],
    nameYear: ['近 12 个月', 'Last 12 months', '直近12か月'],
    changeMore: ['比前 {n} 天多 {v}', '{v} more than the previous {n} days', '前の{n}日より {v} 多い'],
    changeLess: ['比前 {n} 天少 {v}', '{v} less than the previous {n} days', '前の{n}日より {v} 少ない'],
    changeSame: ['和前 {n} 天差不多', 'About the same as the previous {n} days', '前の{n}日とほぼ同じ'],
    changeFlat: ['持平', 'flat', '横ばい'],
    chartAriaWeek: ['近 7 天每日用量，按模型分色', 'Daily usage for the last 7 days, colored by model', '直近7日の日別使用量（モデル別に色分け）'],
    chartAriaYear: ['近 12 个月每月用量', 'Monthly usage for the last 12 months', '直近12か月の月別使用量'],
    lineCaption: ['每月用量', 'Monthly usage', '月別の使用量'],
    linePeak: ['最高 {month} · {v}', 'Peak {month} · {v}', '最多 {month} · {v}'],
    usedRecap: ['上周已使用', 'Used last week', '先週の使用量'],
    nameRecap: ['上周', 'Last week', '先週'],
    changeMoreWeek: ['比前一周多 {v}', '{v} more than the week before', '前の週より {v} 多い'],
    changeLessWeek: ['比前一周少 {v}', '{v} less than the week before', '前の週より {v} 少ない'],
    changeSameWeek: ['和前一周差不多', 'About the same as the week before', '前の週とほぼ同じ'],
    recapAria: ['上周回顾（周一至周日）', 'Last week in review (Mon–Sun)', '先週のふりかえり（月〜日）'],
    recapBusiest: ['最忙的一天', 'Busiest day', '最も使った日'],
    recapModels: ['最常用模型', 'Top models', '主なモデル'],
    recapProjects: ['最常用项目', 'Top projects', '主なプロジェクト'],
    recapQuota: ['周额度最低', 'Weekly quota low', '週間枠の最低'],
    recapQuotaValue: ['剩 {v} · {when}', '{v} left · {when}', '残り {v} · {when}'],
    recapQuotaNone: ['这一周没有额度采样', 'No quota samples that week', 'この週の枠のサンプルなし'],
    recapCost: ['折算费用', 'Est. cost', '換算コスト'],
    recapCostValue: ['≈ {usd} · {sessions} 个会话 · {n}/7 天', '≈ {usd} · {sessions} sessions · {n}/7 days', '≈ {usd} · {sessions} セッション · {n}/7日'],
    recapMissing: ['下一次刷新后显示周报', 'The weekly report shows up after the next refresh', '次の更新後に週報を表示します'],
    recapPeakHour: ['高峰时段', 'Peak hour', 'ピーク時間帯'],
    recapSessions: ['{n} 个会话 · {days}/7 天有用量', '{n} sessions · active {days} of 7 days', '{n} セッション · 7日中{days}日利用'],
    recapCostLine: ['折算 API 成本：上周 ≈ {usd}', 'Est. API cost: last week ≈ {usd}', 'API 換算コスト：先週 ≈ {usd}'],
    recapUnpriced: ['另有 {v} 来自未定价型号，未计入费用', '{v} from unpriced models not included', '料金未公開のモデルの {v} は含みません'],
    recapNote: [
      '统计本机日志里上周一到周日的用量；额度最低点只算应用开着时的采样',
      'Monday to Sunday from local logs on this Mac; the quota low only counts samples taken while the app was running',
      'この Mac のログで先週の月〜日を集計。週間枠の最低値はアプリ起動中のサンプルのみ'
    ],
    recapProjectsTitle: ['上周各项目', 'Projects last week', '先週のプロジェクト'],
    hoursTitle: ['按小时', 'By hour', '時間帯別'],
    hoursPeak: ['高峰 {range} · {v}', 'Peak {range} · {v}', 'ピーク {range} · {v}'],
    hoursEmpty: ['这天没有用量', 'No usage this day', 'この日は使用なし'],
    hoursAria: ['{day} 每小时用量', 'Usage by hour on {day}', '{day} の時間帯別の使用量'],
    fiveWindowOne: ['5 小时窗口 {from}–{to} · 用到 {v}', '5-hour window {from}–{to} · peaked at {v}', '5時間枠 {from}–{to} · 最大 {v}'],
    fiveWindowsMany: ['5 小时窗口 {n} 个 · 最高 {v}（{from}–{to}）', '{n} five-hour windows · peak {v} ({from}–{to})', '5時間枠 {n} 件 · 最大 {v}（{from}–{to}）'],
    fiveWindowItem: ['{from}–{to} 用到 {v}', '{from}–{to} peaked at {v}', '{from}–{to} 最大 {v}'],
    fiveWindowsNone: ['这天没有 5 小时窗口的记录', 'No 5-hour windows recorded this day', 'この日の 5 時間枠の記録なし'],
    fiveUnlimited: ['5 小时额度不限', 'No 5-hour limit', '5 時間枠は無制限'],
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
    attrUnpriced: ['本周用到的型号暂无公开价格，没法按费用折算', 'No public price for the models used this week, so no estimate', '今週使ったモデルは公開価格がないため推定できません'],
    attrAria: ['本周各项目约占的周额度', 'Estimated share of the weekly quota by project', '今週の週間枠に占めるプロジェクト別の推定割合']
  };

  const RANGE_LABEL_KEYS = { week: 'rangeWeek', month: 'rangeMonth', year: 'rangeYear', recap: 'rangeRecap' };

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

  function weekdayShort(lang, date) {
    return new Intl.DateTimeFormat(locale(lang), { weekday: 'short' }).format(date);
  }

  // 周三 11/19、Wed 11/19、水 11/19
  function weekdayDay(lang, day) {
    return `${weekdayShort(lang, parseDay(day))} ${shortDay(day)}`;
  }

  function timeShort(lang, ts) {
    return new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ts));
  }

  // 14:00–15:00（最后一个小时写到 24:00）
  function hourRange(hour) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(hour)}:00–${pad(hour + 1)}:00`;
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

  function coverageOf(activity) {
    const history = activity?.history && typeof activity.history === 'object' ? activity.history : null;
    const firstLiveDay = (activity?.days || []).map((day) => day?.day).filter(isIsoDay).sort()[0] || null;
    return {
      history,
      coverageStart: isIsoDay(history?.coverageStart) ? history.coverageStart : firstLiveDay,
      historyStatus: history ? (history.status === 'ready' ? 'ready' : 'pending') : null
    };
  }

  // 一个时间范围的全部数字：柱子（分组）、合计、和上一段的对比、记录从哪天开始有。
  // 30 天视图没有柱子（两端各画自己的热力图）；7 天 = 每天一根柱子；1 年 = 12 个自然月连成的折线，本月只算到今天；
  // 周报另算（buildRecapView）。对比只在上一段完全有记录时给：本地记录最早一天不晚于上一段开头，
  // 且上一段确实有用量；1 年视图不对比。
  function buildView(range, activity, { now = new Date() } = {}) {
    const key = normalizeRange(range);
    if (key === 'recap') return buildRecapView(activity, { now });
    const days = collectDays(activity);
    const today = startOfDay(now);
    const { coverageStart, historyStatus } = coverageOf(activity);
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
      historyStatus,
      pricingAsOf: isIsoDay(activity?.pricingAsOf) ? activity.pricingAsOf : null,
      todayTotals: sumRange(days, today, today)
    };
  }

  // ---- 周报（2.0.0，第 27 条）：主进程按本机日志算好上周一到周日（src/usage-recap.js），这里只整理和排版 ----

  function nullableNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeReport(raw) {
    if (!raw || typeof raw !== 'object' || !isIsoDay(raw.start) || !isIsoDay(raw.end)) return null;
    const rows = (list, nameKey) => (Array.isArray(list) ? list : [])
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({
        [nameKey]: row[nameKey] ? String(row[nameKey]) : null,
        other: num(row.other),
        tokens: num(row.tokens),
        costUsd: nullableNumber(row.costUsd),
        sessions: num(row.sessions)
      }));
    const hour = Number(raw.busiestHour?.hour);
    const used = nullableNumber(raw.quotaLow?.usedPercent);
    const lowAt = nullableNumber(raw.quotaLow?.at);
    return {
      start: raw.start,
      end: raw.end,
      previousStart: isIsoDay(raw.previousStart) ? raw.previousStart : null,
      tokens: num(raw.tokens),
      ioTokens: num(raw.ioTokens),
      inputTokens: nullableCount(raw.inputTokens),
      cachedInputTokens: nullableCount(raw.cachedInputTokens),
      costUsd: num(raw.costUsd),
      unpricedTokens: num(raw.unpricedTokens),
      sessions: num(raw.sessions),
      activeDays: num(raw.activeDays),
      busiestDay: raw.busiestDay && isIsoDay(raw.busiestDay.day) && num(raw.busiestDay.tokens) > 0
        ? { day: raw.busiestDay.day, tokens: num(raw.busiestDay.tokens) }
        : null,
      busiestHour: Number.isInteger(hour) && hour >= 0 && hour < 24 ? { hour, tokens: num(raw.busiestHour.tokens) } : null,
      models: rows(raw.models, 'model'),
      projects: rows(raw.projects, 'name'),
      previousTokens: num(raw.previousTokens),
      quotaLow: used !== null && lowAt !== null ? { usedPercent: clamp(used, 0, 100), at: lowAt } : null
    };
  }

  // 和 buildView 同样的形状，统计行（「上周已使用」和环比）、明细、配色都按它走；周报没有柱子。
  function buildRecapView(activity, { now = new Date() } = {}) {
    const today = startOfDay(now);
    const days = collectDays(activity);
    const { coverageStart, historyStatus } = coverageOf(activity);
    const report = normalizeReport(activity?.weeklyReport);
    const totals = sumRange(days, today, addDays(today, -1));
    if (report) {
      Object.assign(totals, {
        tokens: report.tokens,
        ioTokens: report.ioTokens,
        inputTokens: report.inputTokens,
        cachedInputTokens: report.cachedInputTokens,
        costUsd: report.costUsd,
        unpricedTokens: report.unpricedTokens,
        threads: report.sessions,
        activeDays: report.activeDays,
        dayCount: 7,
        // 「其他 N 个」那一行没有型号名，配色时并进灰色的「其他」
        models: report.models.map((row) => ({ model: row.model || '', value: row.tokens, costUsd: row.costUsd }))
      });
    }
    let change = null;
    if (report && report.previousTokens > 0 && report.previousStart && coverageStart && coverageStart <= report.previousStart) {
      change = { ratio: report.tokens / report.previousTokens - 1, days: 7, kind: 'week', previousTokens: report.previousTokens };
    }
    return {
      range: 'recap',
      today: isoDate(today),
      rangeStart: report ? report.start : isoDate(today),
      dayCount: 7,
      totals,
      change,
      buckets: [],
      coverageStart,
      historyStatus,
      pricingAsOf: isIsoDay(activity?.pricingAsOf) ? activity.pricingAsOf : null,
      todayTotals: sumRange(days, today, today),
      report
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
    if (view.range === 'year') return text(lang, 'usedYear');
    if (view.range === 'recap') return text(lang, 'usedRecap');
    return text(lang, 'usedDays', { n: RANGE_DAYS[view.range] });
  }

  function rangeName(view, lang) {
    if (view.range === 'year') return text(lang, 'nameYear');
    if (view.range === 'recap') return text(lang, 'nameRecap');
    return text(lang, 'nameDays', { n: RANGE_DAYS[view.range] });
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

  // 「统计详情」那一栏的标题：所选的那一段；周报写「上周 11/16–11/22 · 总量」。
  function summaryText(bucket, lang, view = null) {
    if (view?.range === 'recap') {
      const report = view.report;
      if (!report) return text(lang, 'nameRecap');
      return `${text(lang, 'nameRecap')} ${shortDay(report.start)}–${shortDay(report.end)} · ${formatTokens(lang, report.tokens)}`;
    }
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
    // 周报和「前一周」比，其余和「前 N 天」比
    const suffix = change.kind === 'week' ? 'Week' : '';
    return {
      direction,
      short: direction === 'flat' ? text(lang, 'changeFlat') : `${direction === 'up' ? '↑' : '↓'}${shown}`,
      title: direction === 'flat'
        ? text(lang, `changeSame${suffix}`, { n: change.days })
        : text(lang, `${direction === 'up' ? 'changeMore' : 'changeLess'}${suffix}`, { n: change.days, v: shown })
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
  // 周报没有柱子，按上周的合计分号。
  function seriesFor(view) {
    if (view?.range === 'recap') return TOKEN_WEEK.weekSeries([{ tokens: view.totals.tokens, models: view.totals.models }]);
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

  // columnAttrs(row) 给每根柱子补额外的属性（桌面用它挂悬停提示的数据），返回已转义好的属性串。
  // 7 天画柱状图，1 年画折线（lineChartHtml），周报是一块文字（recapHtml）；30 天由两端各自画格子。
  function chartHtml(view, { lang, skin = 'desktop', selectedKey = null, series = null, columnAttrs = null } = {}) {
    if (view?.range === 'recap') return recapHtml(view, { lang, series });
    if (!view?.buckets?.length) return '';
    if (view.range === 'year') return lineChartHtml(view, { lang, skin, selectedKey, series, columnAttrs });
    const names = SKINS[skin] || SKINS.desktop;
    const colors = series || seriesFor(view);
    const rows = view.buckets.map((bucket) => {
      const segments = TOKEN_WEEK.weekSegments(pseudoDay(bucket), colors);
      return { bucket, segments, total: segments.reduce((sum, segment) => sum + segment.value, 0) };
    });
    const heights = TOKEN_WEEK.barHeights(rows);
    const found = rows.findIndex((row) => row.bucket.key === selectedKey);
    const selectedIndex = found >= 0 ? found : rows.length - 1;
    const legend = [
      ...colors.named.map((name, index) => ({ slot: index + 1, label: modelLabel(name, lang) })),
      ...(colors.hasOther ? [{ slot: 'other', label: text(lang, 'modelOther') }] : [])
    ];
    const interactive = names.tag === 'button' ? 'type="button"' : 'tabindex="0" role="button"';
    return `
    <div class="${names.root}" role="group" aria-label="${escapeHtml(text(lang, 'chartAriaWeek'))}">
      <div class="${names.legend}">
        ${legend.map((item) => `<span class="${names.key}" title="${escapeHtml(item.label)}"><i class="${names.dot} series-${item.slot}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></span>`).join('')}
      </div>
      <div class="${names.plot}" style="${names.colsVar}:${rows.length}">
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
            <span class="${names.label}">${escapeHtml(bucketAxisLabel(bucket, lang))}</span>
          </${names.tag}>`;
        }).join('')}
      </div>
    </div>
  `;
  }

  // 1 年视图（2.0.0 发布前按用户要求换掉了柱状图）：12 个月的合计连成一条 2px 折线，下面铺一层很淡的面积，
  // 颜色是平台主色，和 30 天格子同一个色系；一眼看出一年里用量怎么涨落，和 7 天的柱子、30 天的格子都不一样。
  // 每个月一列透明的点击区（和柱状图的列同一套类名和数据属性），悬停出提示、点击选中；
  // 悬停的月份画一条竖线，选中和悬停的月份在线上标一个圆点，背后不铺底色。本地记录开始之前的月份不画线。
  function lineChartHtml(view, { lang, skin = 'desktop', selectedKey = null, series = null, columnAttrs = null } = {}) {
    const names = SKINS[skin] || SKINS.desktop;
    const colors = series || seriesFor(view);
    const rows = view.buckets;
    const max = Math.max(0, ...rows.map((bucket) => bucket.totals.tokens));
    const heights = rows.map((bucket) => (max > 0 ? (bucket.totals.tokens / max) * LINE_TOP : 0));
    const covered = rows.map((bucket) => !view.coverageStart || bucket.end >= view.coverageStart);
    const first = covered.indexOf(true);
    const step = 1000 / rows.length;
    const points = rows.map((_, index) => ({ x: (index + 0.5) * step, y: 100 - heights[index] }));
    const drawn = first >= 0 ? points.slice(first) : [];
    const line = drawn.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(2)}`).join(' ');
    const area = drawn.length > 1 ? `${line} L${drawn.at(-1).x.toFixed(1)} 100 L${drawn[0].x.toFixed(1)} 100 Z` : '';
    const found = rows.findIndex((bucket) => bucket.key === selectedKey);
    const selectedIndex = found >= 0 ? found : rows.length - 1;
    const visible = labelVisibility(rows.length, YEAR_LABEL_EVERY, selectedIndex);
    let peakIndex = -1;
    rows.forEach((bucket, index) => {
      if (max > 0 && bucket.totals.tokens === max) peakIndex = index;
    });
    const peak = peakIndex >= 0 ? text(lang, 'linePeak', { month: monthShort(lang, rows[peakIndex].start), v: formatTokens(lang, max) }) : '';
    const interactive = names.tag === 'button' ? 'type="button"' : 'tabindex="0" role="button"';
    return `
    <div class="${names.root} is-line" role="group" aria-label="${escapeHtml(text(lang, 'chartAriaYear'))}">
      <div class="${names.legend} line-caption">
        <span>${escapeHtml(text(lang, 'lineCaption'))}</span>
        ${peak ? `<span class="line-peak">${escapeHtml(peak)}</span>` : ''}
      </div>
      <div class="${names.plot} line-plot" style="${names.colsVar}:${rows.length}">
        <svg class="line-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          ${area ? `<path class="line-area" d="${area}"></path>` : ''}
          ${drawn.length > 1 ? `<path class="line-stroke" d="${line}"></path>` : ''}
        </svg>
        ${rows.map((bucket, index) => {
          const selected = index === selectedIndex;
          const title = bucketTitle(bucket, lang);
          const aria = `${title} · ${formatTokens(lang, bucket.totals.tokens)}`;
          const extra = typeof columnAttrs === 'function' ? ` ${columnAttrs({ bucket, series: colors, index })}` : '';
          return `
          <${names.tag} class="${names.col} line-col${selected ? ` ${names.selected}` : ''}${covered[index] ? '' : ' is-uncovered'}" ${interactive} aria-pressed="${selected}" data-bucket="${escapeHtml(bucket.key)}" data-title="${escapeHtml(title)}" aria-label="${escapeHtml(aria)}" style="--y:${heights[index].toFixed(1)}%"${extra}>
            <span class="${names.track}"><i class="line-dot" aria-hidden="true"></i></span>
            <span class="${names.label}${visible[index] ? '' : ' is-blank'}">${escapeHtml(bucketAxisLabel(bucket, lang))}</span>
          </${names.tag}>`;
        }).join('')}
      </div>
    </div>
  `;
  }

  // 周报的模型和项目只在这一块里写前两个（其余看「统计详情」），占比按上周的总量算。
  function shareText(tokens, total) {
    return total > 0 ? `${Math.round((tokens / total) * 100)}%` : '0%';
  }

  function recapModelsHtml(report, colors, lang) {
    const named = report.models.filter((row) => row.model && row.tokens > 0).slice(0, 2);
    if (!named.length) return '<span class="recap-text">—</span>';
    return named.map((row) => {
      const slot = colors.slots.get(row.model) || 'other';
      return `<span class="recap-item"><i class="range-dot series-${slot}" aria-hidden="true"></i><span>${escapeHtml(modelLabel(row.model, lang))}</span> <em>${escapeHtml(shareText(row.tokens, report.tokens))}</em></span>`;
    }).join('');
  }

  function recapProjectsHtml(report, lang) {
    const named = report.projects.filter((row) => !(row.other > 0) && row.tokens > 0).slice(0, 2);
    if (!named.length) return '<span class="recap-text">—</span>';
    return named.map((row) => `<span class="recap-item"><span>${escapeHtml(row.name || text(lang, 'attrUnknown'))}</span> <em>${escapeHtml(shareText(row.tokens, report.tokens))}</em></span>`).join('');
  }

  function quotaWhen(lang, ts) {
    return `${weekdayShort(lang, new Date(ts))} ${timeShort(lang, ts)}`;
  }

  // 周报（第 27 条）：上周一到周日。总量和环比在上面的统计行里，这一块写最忙的一天、用得最多的模型和项目、
  // 周额度最低剩多少、折算费用。和 7 天柱状图、30 天格子叠在同一格里，切换时卡片尺寸不动。
  function recapHtml(view, { lang, series = null } = {}) {
    const report = view.report;
    if (!report) {
      return `<div class="token-recap is-message" role="group" aria-label="${escapeHtml(text(lang, 'recapAria'))}"><p class="recap-message">${escapeHtml(text(lang, 'recapMissing'))}</p></div>`;
    }
    const colors = series || seriesFor(view);
    const quota = report.quotaLow
      ? text(lang, 'recapQuotaValue', { v: `${Math.max(0, Math.round(100 - report.quotaLow.usedPercent))}%`, when: quotaWhen(lang, report.quotaLow.at) })
      : text(lang, 'recapQuotaNone');
    const plain = (value) => `<span class="recap-text">${escapeHtml(value)}</span>`;
    const rows = [
      [text(lang, 'recapBusiest'), plain(report.busiestDay ? `${weekdayDay(lang, report.busiestDay.day)} · ${formatTokens(lang, report.busiestDay.tokens)}` : '—')],
      [text(lang, 'recapModels'), recapModelsHtml(report, colors, lang)],
      [text(lang, 'recapProjects'), recapProjectsHtml(report, lang)],
      [text(lang, 'recapQuota'), plain(quota)],
      [text(lang, 'recapCost'), plain(text(lang, 'recapCostValue', { usd: formatUsd(report.costUsd), sessions: report.sessions, n: report.activeDays }))]
    ];
    // 日期写在下面「统计详情」那一行（上周 11/16–11/22 · 总量），这里五行平分格子区的高度，最矮的手机也放得下。
    const aria = `${text(lang, 'recapAria')} · ${shortDay(report.start)}–${shortDay(report.end)}`;
    return `
    <div class="token-recap" role="group" aria-label="${escapeHtml(aria)}">
      <dl class="recap-rows">
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join('')}
      </dl>
    </div>
  `;
  }

  // 一段时间里各项目的用量：横条长度按用量最多的项目折算，右边写 token 和费用（桌面单日明细也是这个样子）。
  function projectListHtml(projects, { lang, title } = {}) {
    const rows = (Array.isArray(projects) ? projects : []).filter((row) => row && num(row.tokens) > 0);
    if (!rows.length) return '';
    const max = Math.max(1, ...rows.map((row) => num(row.tokens)));
    return `
    <div class="project-breakdown">
      <p class="project-title">${escapeHtml(title)}</p>
      <ul>
        ${rows.map((row) => {
          const label = row.other > 0 ? text(lang, 'attrOther', { n: row.other }) : (row.name || text(lang, 'attrUnknown'));
          const width = Math.max(2, (num(row.tokens) / max) * 100).toFixed(1);
          const cost = row.costUsd === null || row.costUsd === undefined ? '' : ` · ${formatUsd(row.costUsd)}`;
          return `<li title="${escapeHtml(label)}"><span class="project-name">${escapeHtml(label)}</span><span class="project-bar"><i style="width:${width}%"></i></span><span class="project-value">${escapeHtml(`${formatTokens(lang, row.tokens, false)}${cost}`)}</span></li>`;
        }).join('')}
      </ul>
    </div>
  `;
  }

  // 周报的「统计详情」：读写、命中率、高峰时段、会话和活跃天数，按模型和按项目的拆分，以及费用和口径说明。
  function recapDetailHtml(view, { lang, series = null } = {}) {
    const report = view.report;
    if (!report) return `<p class="detail-note">${escapeHtml(text(lang, 'recapMissing'))}</p>`;
    const name = text(lang, 'nameRecap');
    const notes = [
      text(lang, 'recapCostLine', { usd: formatUsd(report.costUsd) }),
      report.unpricedTokens > 0 ? text(lang, 'recapUnpriced', { v: formatTokens(lang, report.unpricedTokens) }) : '',
      text(lang, 'recapNote'),
      view.pricingAsOf ? text(lang, 'costHint', { date: shortDay(view.pricingAsOf) }) : ''
    ].filter(Boolean);
    return `
      <dl class="detail-metrics">
        ${metricHtml(name, text(lang, 'ioAmount', { v: formatTokens(lang, report.ioTokens, false) }))}
        ${metricHtml(name, text(lang, 'cacheHit', { v: formatCacheHit(lang, report.cachedInputTokens, report.inputTokens) }))}
        ${metricHtml(text(lang, 'recapPeakHour'), report.busiestHour ? hourRange(report.busiestHour.hour) : '—')}
        ${metricHtml(name, text(lang, 'recapSessions', { n: report.sessions, days: report.activeDays }))}
      </dl>
      ${modelsHtml(view.totals, { lang, series: series || seriesFor(view) })}
      ${projectListHtml(report.projects, { lang, title: text(lang, 'recapProjectsTitle') })}
      ${notes.map((note) => `<p class="detail-note">${escapeHtml(note)}</p>`).join('')}
    `;
  }

  // ---- 单日明细：按小时分布（2.0.0，第 28 条） ----

  // 一天 24 根细柱，最高的一小时用主色、其余用浅一档；下面一条细轨标出这天的 5 小时窗口（悬停看起止和百分比），
  // 再用一行字写出窗口个数和用得最多的那个（只有一个时写它的起止和百分比）。GPT 不限 5 小时额度时这一行写「不限」，
  // 没有采样的日子写「没有记录」，两个平台这一块一样高。day.hours 是本地时间每小时的 token 数（主进程按会话记录算）。
  function hoursHtml(day, { lang, windows = [], fiveHourUnlimited = false } = {}) {
    if (!isIsoDay(day?.day)) return '';
    // 主进程只发有用量的天；没用的那天也照样画（全空），两个平台、每一天这一块都一样高。
    // 有用量却没有 hours 的是旧版数据，不画。
    let hours = Array.isArray(day.hours) && day.hours.length === 24 ? day.hours.map(num) : null;
    if (!hours && !(num(day.tokens) > 0)) hours = new Array(24).fill(0);
    if (!hours) return '';
    const max = Math.max(0, ...hours);
    const peakHour = max > 0 ? hours.indexOf(max) : -1;
    const start = parseDay(day.day).getTime();
    const end = addDays(parseDay(day.day), 1).getTime();
    const span = end - start;
    const dayWindows = (Array.isArray(windows) ? windows : [])
      .filter((item) => Number(item?.endAt) > start && Number(item?.startAt) < end && Number(item?.endAt) > Number(item?.startAt))
      .sort((left, right) => left.startAt - right.startAt);
    const bars = hours.map((value, hour) => {
      const height = value > 0 ? Math.max(6, (value / max) * 100) : 0;
      return `<i class="hours-bar${hour === peakHour ? ' is-peak' : ''}" style="height:${height.toFixed(1)}%"></i>`;
    }).join('');
    const describe = (item) => text(lang, 'fiveWindowItem', {
      from: timeShort(lang, item.startAt),
      to: timeShort(lang, item.endAt),
      v: `${Math.round(Number(item.peak) || 0)}%`
    });
    const marks = dayWindows.map((item) => {
      const from = Math.max(start, Number(item.startAt));
      const to = Math.min(end, Number(item.endAt));
      return `<i class="hours-window" title="${escapeHtml(describe(item))}" style="left:${(((from - start) / span) * 100).toFixed(2)}%;width:${Math.max(0.8, ((to - from) / span) * 100).toFixed(2)}%"></i>`;
    }).join('');
    const head = peakHour >= 0
      ? text(lang, 'hoursPeak', { range: hourRange(peakHour), v: formatTokens(lang, max) })
      : text(lang, 'hoursEmpty');
    let windowText = text(lang, 'fiveWindowsNone');
    let windowTitle = windowText;
    if (fiveHourUnlimited) {
      windowText = text(lang, 'fiveUnlimited');
      windowTitle = windowText;
    } else if (dayWindows.length) {
      // 用得最多的那个窗口；一样多时取早的
      const top = dayWindows.reduce((best, item) => (Number(item.peak) > Number(best.peak) ? item : best), dayWindows[0]);
      const params = { n: dayWindows.length, from: timeShort(lang, top.startAt), to: timeShort(lang, top.endAt), v: `${Math.round(Number(top.peak) || 0)}%` };
      windowText = text(lang, dayWindows.length > 1 ? 'fiveWindowsMany' : 'fiveWindowOne', params);
      windowTitle = dayWindows.map(describe).join(' · ');
    }
    return `
    <div class="hours-strip">
      <div class="hours-head"><span>${escapeHtml(text(lang, 'hoursTitle'))}</span><b>${escapeHtml(head)}</b></div>
      <div class="hours-plot" role="img" aria-label="${escapeHtml(`${text(lang, 'hoursAria', { day: shortDay(day.day) })} · ${head}`)}">${bars}</div>
      <div class="hours-windows-track" aria-hidden="true">${marks}</div>
      <div class="hours-axis" aria-hidden="true"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
      <p class="hours-windows" title="${escapeHtml(windowTitle)}">${escapeHtml(windowText)}</p>
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

  // 1 年视图下「统计详情」展开后的内容：所选那个月和整个范围的读写、命中率，所选那个月的活跃天数、
  // 按模型拆分和费用。这些天的日汇总里没有项目拆分，所以不列项目。周报的明细另见 recapDetailHtml。
  function bucketDetailHtml(view, bucket, { lang, series = null } = {}) {
    if (view?.range === 'recap') return recapDetailHtml(view, { lang, series });
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
    // 窗口里有本机用量、但用到的型号都没有公开价格（Antigravity 的 Gemini）：说明原因，别说「用得太少」。
    const unpricedOnly = !ready && costUsd <= 0 && num(attribution.unpricedTokens) > 0;
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
      unpricedOnly,
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
        rows.push(`<li class="attribution-row is-message"><span>${escapeHtml(text(lang, model.unpricedOnly ? 'attrUnpriced' : 'attrTooLittle'))}</span></li>`);
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
    buildRecapView,
    normalizeReport,
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
    lineChartHtml,
    recapHtml,
    recapDetailHtml,
    projectListHtml,
    hoursHtml,
    hourRange,
    tooltipModels,
    modelsHtml,
    historyNote,
    bucketDetailHtml,
    attributionModel,
    formatPoints,
    attributionHtml
  };
});
