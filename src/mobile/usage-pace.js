// 额度「节奏」的纯计算：已用% 对比窗口已过%，按窗口内的平均速度外推用尽时间。
// 主进程（菜单栏、提醒、Touch Bar、手机快照）和渲染层共用这一份，避免各算各的。
// 只用接口给出的百分比和 resetAt，不从 token 反推剩余额度。
(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.CMM_PACE = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const HOUR_MS = 3_600_000;
  const DAY_MS = 24 * HOUR_MS;
  const FIVE_HOUR_MS = 5 * HOUR_MS;
  const WEEK_MS = 7 * DAY_MS;

  // 窗口刚开始时平均速度噪声很大（开窗 5 分钟用了 3% 会外推成 180%），
  // 已过时间不到窗口的 5%（且不少于 10 分钟）时只标「刚开始」，不给用尽预测。
  const MIN_ELAPSED_RATIO = 0.05;
  const MIN_ELAPSED_MS = 10 * 60_000;
  // 已用% 比已过% 高出多少算「偏快」「明显偏快」；低多少算「有余」。
  const AHEAD_WARNING = 5;
  const AHEAD_SERIOUS = 15;
  const BEHIND = -5;

  const TIER_RANK = { critical: 4, serious: 3, warning: 2, good: 1, neutral: 0 };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function windowDurationMs(key, provider) {
    if (key === 'five') return FIVE_HOUR_MS;
    if (key === 'week') return WEEK_MS;
    // Claude 的额外窗口都是按模型划分的周限额（limits[] 里的 weekly_scoped）。
    if (provider === 'claude' && String(key).startsWith('extra:')) return WEEK_MS;
    return null;
  }

  // 返回 null 表示没有可用数据；其余情况都给出 status 与 tier，界面按 tier 上色、按 status 出文案。
  function computePace(windowValue, { durationMs, now = Date.now() } = {}) {
    if (!windowValue || typeof windowValue !== 'object') return null;
    const usedPercent = Number(windowValue.usedPercent);
    if (!Number.isFinite(usedPercent)) return null;
    const resetAt = Number(windowValue.resetAt) || null;
    const base = {
      usedPercent,
      remainingPercent: clamp(100 - usedPercent, 0, 100),
      resetAt,
      durationMs: durationMs || null,
      startAt: null,
      elapsedPercent: null,
      delta: null,
      projectedPercent: null,
      runOutAt: null,
      lastsUntilReset: null,
      earlyByMs: null,
      ready: false
    };

    // resetAt 已经过去：接口数据还停在上个窗口，界面应显示「已重置」而不是「即将重置」。
    if (resetAt && resetAt <= now) {
      return { ...base, status: 'reset', tier: 'neutral' };
    }
    if (usedPercent >= 100) {
      return { ...base, status: 'exhausted', tier: 'critical', runOutAt: now, lastsUntilReset: false };
    }
    if (!resetAt || !durationMs) {
      return { ...base, status: windowValue.inactive ? 'idle' : 'unknown', tier: 'neutral' };
    }

    const startAt = resetAt - durationMs;
    const elapsedMs = clamp(now - startAt, 0, durationMs);
    const elapsedPercent = (elapsedMs / durationMs) * 100;
    const delta = usedPercent - elapsedPercent;
    const ready = elapsedMs >= Math.max(durationMs * MIN_ELAPSED_RATIO, MIN_ELAPSED_MS);
    const result = {
      ...base,
      startAt,
      elapsedPercent,
      delta,
      ready
    };
    if (!ready) {
      return { ...result, status: 'early', tier: 'good' };
    }

    const projectedPercent = elapsedMs > 0 ? (usedPercent * durationMs) / elapsedMs : usedPercent;
    const runOutAt = usedPercent > 0 ? startAt + (100 * elapsedMs) / usedPercent : null;
    const lastsUntilReset = !runOutAt || runOutAt >= resetAt;
    let status = 'on-pace';
    let tier = 'good';
    if (delta >= AHEAD_SERIOUS) {
      status = 'ahead';
      tier = 'serious';
    } else if (delta >= AHEAD_WARNING) {
      status = 'ahead';
      tier = 'warning';
    } else if (delta <= BEHIND) {
      status = 'behind';
    }
    return {
      ...result,
      status,
      tier,
      projectedPercent,
      runOutAt: lastsUntilReset ? null : runOutAt,
      lastsUntilReset,
      earlyByMs: lastsUntilReset ? null : resetAt - runOutAt
    };
  }

  // 把一个平台的用量拆成可比较的窗口列表；Codex 已取消 5 小时限制时不列 5h。
  function listWindows(usage, { provider = '', now = Date.now() } = {}) {
    if (!usage || typeof usage !== 'object') return [];
    const list = [];
    const push = (key, windowValue, name) => {
      if (!windowValue || typeof windowValue !== 'object') return;
      const durationMs = windowDurationMs(key, provider);
      list.push({
        key,
        name: name || null,
        window: windowValue,
        durationMs,
        pace: computePace(windowValue, { durationMs, now })
      });
    };
    if (!usage.fiveHourUnlimited) push('five', usage.primaryWindow);
    push('week', usage.secondaryWindow);
    for (const extra of Array.isArray(usage.extraWindows) ? usage.extraWindows : []) {
      if (!extra || extra.inactive) continue;
      push(`extra:${extra.name || 'limit'}`, extra, extra.name || null);
    }
    return list;
  }

  // 最紧的限额：剩余最少的那个；剩余相同时取节奏更快（delta 更大）的。
  // 已过 resetAt 的窗口数据不可信，不参与比较。
  function tightestWindow(entries) {
    const candidates = (entries || []).filter((entry) => entry?.pace && entry.pace.status !== 'reset');
    if (!candidates.length) return null;
    return candidates.slice().sort((a, b) => {
      const remaining = a.pace.remainingPercent - b.pace.remainingPercent;
      if (remaining !== 0) return remaining;
      return (b.pace.delta ?? -Infinity) - (a.pace.delta ?? -Infinity);
    })[0];
  }

  // 节奏最危险的窗口（用于提醒、Touch Bar 上色）：先比 tier，再比剩余。
  function mostUrgent(entries) {
    const candidates = (entries || []).filter((entry) => entry?.pace);
    if (!candidates.length) return null;
    return candidates.slice().sort((a, b) => {
      const tier = (TIER_RANK[b.pace.tier] || 0) - (TIER_RANK[a.pace.tier] || 0);
      if (tier !== 0) return tier;
      return a.pace.remainingPercent - b.pace.remainingPercent;
    })[0];
  }

  function tierRank(tier) {
    return TIER_RANK[tier] || 0;
  }

  // 数据是否过期：最后一次成功获取距今超过 staleAfterMs。
  function isStale(fetchedAt, staleAfterMs, now = Date.now()) {
    const at = Number(fetchedAt);
    if (!at || !staleAfterMs) return false;
    return now - at > staleAfterMs;
  }

  // 按模型的额外窗口（sample.ex = { 名称: 已用% }）各自重置，也要单独比较。
  function droppedExtra(current, previous) {
    if (!current || !previous) return false;
    return Object.keys(current).some((name) => Number.isFinite(current[name]) && Number.isFinite(previous[name]) && current[name] < previous[name]);
  }

  // 按固定时间桶压缩样本：每桶只留最后一个；桶内某个序列回落（窗口重置）时，
  // 把回落前的那个点也留下，峰值不会被压掉。样本须按时间升序，keys 是要比较的数值字段。
  function compactSamples(samples, bucketMs, keys) {
    if (!Array.isArray(samples) || !samples.length || !(bucketMs > 0)) return Array.isArray(samples) ? samples : [];
    const out = [];
    let bucket = null;
    let last = null;
    for (const sample of samples) {
      const current = Math.floor(sample.t / bucketMs);
      if (last && current === bucket) {
        const dropped = (keys || []).some((key) => Number.isFinite(sample[key]) && Number.isFinite(last[key]) && sample[key] < last[key])
          || droppedExtra(sample.ex, last.ex);
        if (dropped) out.push(last);
      } else if (last) {
        out.push(last);
      }
      bucket = current;
      last = sample;
    }
    if (last) out.push(last);
    return out;
  }

  return {
    HOUR_MS,
    DAY_MS,
    FIVE_HOUR_MS,
    WEEK_MS,
    AHEAD_WARNING,
    AHEAD_SERIOUS,
    windowDurationMs,
    computePace,
    listWindows,
    tightestWindow,
    mostUrgent,
    tierRank,
    isStale,
    compactSamples
  };
});
