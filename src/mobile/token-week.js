// Token 活动「近 7 天」直方图的纯计算（1.1.0）：哪些模型单独成色、每天每段多高、型号怎么写。
// 桌面面板（src/renderer.js）和手机页（src/mobile/mobile.js）共用这一份，测试在 test/token-week.test.js。
(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.CMM_TOKEN_WEEK = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const WEEK_DAYS = 7;
  // 单独成色的模型数：近 7 天用量前三，其余并成灰色「其他」（分类色只配了 3 个）。
  const SERIES_LIMIT = 3;

  function modelTokens(model) {
    return Math.max(0, Number(model?.value ?? model?.tokens ?? model?.weighted ?? 0) || 0);
  }

  // 配色跟着模型走：按 7 天合计排名一次性分号，同一张图、图例和提示用同一套编号，
  // 不会因为某一天的排名变化而换色。没记型号的用量（day.tokens 比各模型之和多出的部分）算进「其他」。
  function weekSeries(days, limit = SERIES_LIMIT) {
    const totals = new Map();
    let unattributed = 0;
    for (const day of days || []) {
      let attributed = 0;
      for (const model of day?.models || []) {
        const name = String(model?.model || '');
        const value = modelTokens(model);
        attributed += value;
        if (name && value > 0) totals.set(name, (totals.get(name) || 0) + value);
      }
      unattributed += Math.max(0, Number(day?.tokens || 0) - attributed);
    }
    const ranked = [...totals.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const named = ranked.slice(0, limit).map(([name]) => name);
    return {
      named,
      slots: new Map(named.map((name, index) => [name, index + 1])),
      hasOther: ranked.length > limit || unattributed > 0
    };
  }

  // 一天的柱子从下往上：1 号色、2 号色、3 号色、其他；用量为 0 的段不画。
  function weekSegments(day, series) {
    const values = new Map();
    let attributed = 0;
    for (const model of day?.models || []) {
      const value = modelTokens(model);
      attributed += value;
      const slot = series.slots.get(String(model?.model || '')) || 'other';
      values.set(slot, (values.get(slot) || 0) + value);
    }
    const rest = Math.max(0, Number(day?.tokens || 0) - attributed);
    if (rest > 0) values.set('other', (values.get('other') || 0) + rest);
    return [...series.named.map((_, index) => index + 1), 'other']
      .map((slot) => ({ slot, value: values.get(slot) || 0 }))
      .filter((segment) => segment.value > 0);
  }

  // 柱高按 7 天里最高的一天折成百分比；有用量的天至少 4%，免得小数值看不见。
  function barHeights(rows) {
    const max = Math.max(1, ...rows.map((row) => row.total));
    return rows.map((row) => (row.total > 0 ? Math.max(4, (row.total / max) * 100) : 0));
  }

  // 型号写法和雷达页一致：gpt-6.2-sol → GPT-6.2 Sol，claude-opus-5-5 → Opus 5.5。
  function formatModelName(value) {
    const raw = String(value || '').replace(/-(\d{8})$/, '');
    const claudeMatch = raw.match(/^claude-([a-z]+)-(\d+(?:-\d+)*)$/i);
    if (claudeMatch) {
      const family = claudeMatch[1];
      const version = claudeMatch[2].split('-').join('.');
      return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${version}`;
    }
    const gptMatch = raw.match(/^gpt-(\d+(?:\.\d+)*)(?:-(.+))?$/i);
    if (gptMatch) {
      const suffix = gptMatch[2]
        ? ` ${gptMatch[2].split('-').filter(Boolean).map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')}`
        : '';
      return `GPT-${gptMatch[1]}${suffix}`;
    }
    if (/^gpt-/i.test(raw)) return raw.replace(/^gpt/i, 'GPT');
    return raw.replace(/^claude-/i, '');
  }

  return {
    WEEK_DAYS,
    SERIES_LIMIT,
    modelTokens,
    weekSeries,
    weekSegments,
    barHeights,
    formatModelName
  };
});
