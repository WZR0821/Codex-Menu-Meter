'use strict';

// 周报（2.0.0，建议清单第 27 条）和单日明细里的 5 小时窗口（第 28 条）的纯计算。
// 主进程拿本机会话记录和额度采样调用，结果挂在 Token 活动上发给面板和手机；这里不读文件、不发请求。
// 测试在 test/usage-recap.test.js。

const HOUR_MS = 3_600_000;
const FIVE_HOUR_MS = 5 * HOUR_MS;
// 周报列出的模型和项目数，其余并成一行「其他 N 个」。
const REPORT_TOP = 3;
// 同一个 5 小时窗口在不同次采样里给出的 resetAt 可能差几秒到几分钟（Codex 按「还剩多少秒」折算），这么近的算同一个窗口。
const RESET_MERGE_MS = 10 * 60_000;
// 采样时间落在窗口之外这么多以上，说明是窗口结束后还挂着的旧值，不算。
const SAMPLE_SLACK_MS = 60_000;

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function roundCents(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

// 上一个完整的自然周：本地时区周一 0 点到本周一 0 点（周一算一周的第一天）。
function lastCompleteWeek(now = Date.now()) {
  const today = new Date(now);
  const weekday = (today.getDay() + 6) % 7;
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday);
  const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
  const previous = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 14);
  return { startAt: start.getTime(), endAt: thisMonday.getTime(), previousStartAt: previous.getTime() };
}

// 排名前几的留下，其余并成一行（other 记并进去的个数）。
function topRows(map, makeRow) {
  const sorted = [...map.values()].sort((a, b) => b.tokens - a.tokens || String(a.name ?? a.model ?? '').localeCompare(String(b.name ?? b.model ?? '')));
  const rows = sorted.slice(0, REPORT_TOP).map(makeRow);
  const rest = sorted.slice(REPORT_TOP);
  if (rest.length) {
    const priced = rest.every((item) => item.priced !== false);
    rows.push({
      ...makeRow({ name: null, model: null, tokens: 0, costUsd: 0, sessions: new Set() }),
      other: rest.length,
      tokens: rest.reduce((sum, item) => sum + item.tokens, 0),
      costUsd: priced ? roundCents(rest.reduce((sum, item) => sum + item.costUsd, 0)) : null
    });
  }
  return rows;
}

// 一周的回顾：总量、折算费用、会话数、有用量的天数、最忙的一天和时段、用得最多的模型和项目、
// 和前一周比的基数，以及这一周里周额度用到的最高点（即剩余的最低点）。
// entries 是本机会话记录（ts、tokens、ioTokens、inputTokens、cachedInputTokens、model、sessionId、cwd），
// costOf(entry) 给等价费用（未定价返回 null），createProjectResolver(cwds) 返回 cwd → { key, name } 的归并函数，
// samples 是额度采样（t、week = 周额度已用百分比）。
function buildWeeklyReport(entries, { now = Date.now(), costOf = () => null, createProjectResolver = null, samples = [] } = {}) {
  const { startAt, endAt, previousStartAt } = lastCompleteWeek(now);
  const list = Array.isArray(entries) ? entries : [];
  const inWeek = list.filter((entry) => entry && entry.ts >= startAt && entry.ts < endAt);
  const resolve = typeof createProjectResolver === 'function'
    ? createProjectResolver(inWeek.map((entry) => entry.cwd))
    : () => ({ key: '', name: null });
  const days = new Map();
  const hours = new Array(24).fill(0);
  const models = new Map();
  const projects = new Map();
  const sessions = new Set();
  const totals = { tokens: 0, ioTokens: 0, inputTokens: 0, cachedInputTokens: 0, costUsd: 0, unpricedTokens: 0 };
  for (const entry of inWeek) {
    const tokens = count(entry.tokens);
    const cost = costOf(entry);
    const priced = cost !== null && cost !== undefined && Number.isFinite(Number(cost));
    totals.tokens += tokens;
    totals.ioTokens += count(entry.ioTokens);
    totals.inputTokens += count(entry.inputTokens);
    totals.cachedInputTokens += count(entry.cachedInputTokens);
    if (priced) totals.costUsd += Number(cost);
    else totals.unpricedTokens += tokens;
    const date = new Date(entry.ts);
    const day = isoDate(date);
    days.set(day, (days.get(day) || 0) + tokens);
    hours[date.getHours()] += tokens;
    if (entry.sessionId) sessions.add(entry.sessionId);
    if (entry.model) {
      const model = models.get(entry.model) || { model: entry.model, tokens: 0, costUsd: 0, priced: true };
      model.tokens += tokens;
      if (priced) model.costUsd += Number(cost);
      else model.priced = false;
      models.set(entry.model, model);
    }
    const project = resolve(entry.cwd);
    const projectTotals = projects.get(project.key) || { name: project.name, tokens: 0, costUsd: 0, sessions: new Set() };
    projectTotals.tokens += tokens;
    if (priced) projectTotals.costUsd += Number(cost);
    if (entry.sessionId) projectTotals.sessions.add(entry.sessionId);
    projects.set(project.key, projectTotals);
  }

  let busiestDay = null;
  for (const [day, tokens] of days) {
    if (tokens > 0 && (!busiestDay || tokens > busiestDay.tokens)) busiestDay = { day, tokens };
  }
  const peakTokens = Math.max(0, ...hours);
  const busiestHour = peakTokens > 0 ? { hour: hours.indexOf(peakTokens), tokens: peakTokens } : null;

  const previousTokens = list
    .filter((entry) => entry && entry.ts >= previousStartAt && entry.ts < startAt)
    .reduce((sum, entry) => sum + count(entry.tokens), 0);

  // 周额度最低点：这一周里采到的周额度已用百分比的最高值。应用没开着的时候没有采样，所以可能偏低或没有。
  let quotaLow = null;
  for (const sample of Array.isArray(samples) ? samples : []) {
    const t = Number(sample?.t);
    if (!(t >= startAt && t < endAt) || sample.week === null || sample.week === undefined) continue;
    const used = Number(sample.week);
    if (!Number.isFinite(used)) continue;
    if (!quotaLow || used > quotaLow.usedPercent) quotaLow = { usedPercent: Math.max(0, Math.min(100, used)), at: t };
  }

  return {
    start: isoDate(new Date(startAt)),
    end: isoDate(new Date(endAt - 1)),
    previousStart: isoDate(new Date(previousStartAt)),
    tokens: totals.tokens,
    ioTokens: totals.ioTokens,
    inputTokens: totals.inputTokens,
    cachedInputTokens: totals.cachedInputTokens,
    costUsd: roundCents(totals.costUsd),
    unpricedTokens: totals.unpricedTokens,
    sessions: sessions.size,
    activeDays: [...days.values()].filter((tokens) => tokens > 0).length,
    busiestDay,
    busiestHour,
    models: topRows(models, (item) => ({ model: item.model, tokens: item.tokens, costUsd: item.priced ? roundCents(item.costUsd) : null })),
    projects: topRows(projects, (item) => ({ name: item.name, tokens: item.tokens, costUsd: roundCents(item.costUsd), sessions: item.sessions.size })),
    previousTokens,
    quotaLow
  };
}

// 从额度采样里还原出每个 5 小时窗口：起止时间（resetAt 往前推 5 小时）和窗口里采到的最高已用百分比。
// 采样按时间排好序；since 之前结束的窗口不要。用量为 0 的窗口不算（Claude 只有发了消息才开窗口）。
function fiveHourWindows(samples, { since = 0, durationMs = FIVE_HOUR_MS } = {}) {
  const windows = [];
  for (const sample of Array.isArray(samples) ? samples : []) {
    if (sample?.five === null || sample?.five === undefined) continue;
    const reset = Number(sample.fiveReset);
    const used = Number(sample.five);
    const t = Number(sample.t);
    if (!(reset > 0) || !Number.isFinite(used) || !Number.isFinite(t) || reset < since) continue;
    if (t > reset + SAMPLE_SLACK_MS || t < reset - durationMs - SAMPLE_SLACK_MS) continue;
    const last = windows[windows.length - 1];
    if (last && Math.abs(last.endAt - reset) <= RESET_MERGE_MS) {
      last.peak = Math.max(last.peak, used);
      continue;
    }
    windows.push({ startAt: reset - durationMs, endAt: reset, peak: used });
  }
  return windows
    .filter((item) => item.peak > 0)
    .map((item) => ({ startAt: item.startAt, endAt: item.endAt, peak: Math.round(Math.min(100, item.peak)) }));
}

module.exports = {
  REPORT_TOP,
  lastCompleteWeek,
  buildWeeklyReport,
  fiveHourWindows
};
