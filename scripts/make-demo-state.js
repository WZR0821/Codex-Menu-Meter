#!/usr/bin/env node
'use strict';
// README 截图和手工 QA 用的合成演示状态（2.0.0）。项目名、用量、费用都是编的，按固定种子生成，
// 不读本机任何日志或凭证。渲染层按“今天”画日历和柱状图，所以日期从运行当天往回排，截图前现生成一份：
//   node scripts/make-demo-state.js > "$TMPDIR/cmm-demo.json"
//   ./node_modules/.bin/electron scripts/qa-render.js "$TMPDIR/cmm-demo.json" codex usage docs/screenshots/codex-usage.png
// --today=YYYY-MM-DD 固定“今天”（核对生成结果时用；截图要用真实的今天，否则日历对不上）。
// 两个种子是 2026-11-23 拍 README 截图时挑的，那天的环比比较温和（GPT 近 30 天约 +20%，Claude 近 7 天 +5% 到 +8%，随拍摄的钟点变）；
// 换一天生成，数值和环比都会跟着变。每小时的用量、5 小时窗口和周报（2.0.0）由各天的记录推出来，不改动这些数。

const fs = require('fs');
const path = require('path');
const { lastCompleteWeek } = require('../src/usage-recap');

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WINDOW_DAYS = 30; // 和 main.js 的 ACTIVITY_WINDOW_DAYS 一致：窗口内的天带项目明细
const HISTORY_VIEW_DAYS = 366; // 和 main.js 的 HISTORY_VIEW_DAYS 一致：窗口之前的天放进 history
const ATTRIBUTION_PROJECTS = 2; // 和 main.js 一致：额度去向列出前两个项目，其余并成「其他 N 个」

// 每百万 token 的美元单价：未命中缓存的输入、缓存命中、输出。只为让折算费用的量级像样，不是真实价目。
const PRICES = {
  'gpt-6.2-astra': [5, 0.5, 40],
  'gpt-5.5': [1.25, 0.125, 10],
  'claude-opus-5-5': [6.25, 0.5, 25],
  'claude-fable-5-2': [18.75, 1.5, 75],
  'claude-sonnet-5-5': [3.75, 0.3, 15]
};

const PROFILES = {
  codex: {
    seed: 9,
    source: 'codex_local',
    tokensPerDay: [2.2e6, 9e6], // 一年前 → 今天的日均量
    cachedShare: [0.94, 0.985],
    outputShare: [0.003, 0.007],
    // 和 codex-token-activity.js 的加权一致：(input - cached) + cached * 0.1 + output * 6
    weights: { uncached: 1, cached: 0.1, output: 6 },
    models: (age) => (age > 150
      ? [['gpt-5.5', 1]]
      : age > 60 ? [['gpt-6.2-astra', 0.55], ['gpt-5.5', 0.45]] : [['gpt-6.2-astra', 0.82], ['gpt-5.5', 0.18]]),
    projects: [['notes-app', 5], ['landing-page', 3], ['cli-tools', 2], ['data-pipeline', 2], ['blog', 1]],
    threads: 6
  },
  claude: {
    seed: 19,
    source: 'claude_local',
    tokensPerDay: [45e6, 190e6],
    cachedShare: [0.955, 0.985],
    outputShare: [0.004, 0.007],
    // 和 claude-token-activity.js 的加权大致一致（未命中缓存的输入按写缓存 1.25 倍算）
    weights: { uncached: 1.25, cached: 0.1, output: 5 },
    models: (age) => (age > 200
      ? [['claude-opus-5-5', 0.75], ['claude-sonnet-5-5', 0.25]]
      : [['claude-opus-5-5', 0.68], ['claude-fable-5-2', 0.2], ['claude-sonnet-5-5', 0.12]]),
    projects: [['notes-app', 4], ['design-system', 3], ['api-server', 3], ['docs-site', 2], ['mobile-client', 2], ['scripts', 1]],
    threads: 8
  }
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = ([from, to], ratio) => from + (to - from) * ratio;
const roundCents = (value) => Math.round(value * 100) / 100;
const round4 = (value) => Math.round(value * 10_000) / 10_000;

function isoDay(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseArgs(argv) {
  const todayArg = argv.find((arg) => arg.startsWith('--today='));
  if (!todayArg) {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return { today, now: now.getTime() };
  }
  const [year, month, day] = todayArg.slice('--today='.length).split('-').map(Number);
  const today = new Date(year, month - 1, day);
  if (Number.isNaN(today.getTime())) throw new Error(`bad --today: ${todayArg}`);
  return { today, now: today.getTime() + 15 * HOUR_MS };
}

function costOf(model, { uncached, cached, output }) {
  const [inPrice, cachedPrice, outPrice] = PRICES[model];
  return (uncached * inPrice + cached * cachedPrice + output * outPrice) / 1e6;
}

function pickProjects(random, projects, count) {
  const pool = projects.slice();
  const picked = [];
  while (picked.length < count && pool.length) {
    const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = random() * total;
    const index = pool.findIndex(([, weight]) => (roll -= weight) < 0);
    picked.push(pool.splice(index < 0 ? pool.length - 1 : index, 1)[0]);
  }
  return picked;
}

// 一天的记录，字段和 main.js / daily-store.js 产出的一样。
function buildDay(profile, random, { date, age, todayFraction }) {
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const progress = 1 - age / (HISTORY_VIEW_DAYS - 1);
  const swing = Math.exp((random() + random() - 1) * 1.1);
  let tokens = lerp(profile.tokensPerDay, progress) * swing * (weekend ? 0.55 : 1);
  if (age === 0) tokens *= todayFraction;
  tokens = Math.round(tokens);
  const outputTokens = Math.round(tokens * lerp(profile.outputShare, random()));
  const inputTokens = tokens - outputTokens;
  const cachedInputTokens = Math.round(inputTokens * lerp(profile.cachedShare, random()));
  const uncachedTokens = inputTokens - cachedInputTokens;
  const { weights } = profile;

  const shares = profile.models(age).map(([model, share]) => [model, share * (0.85 + random() * 0.3)]);
  const shareTotal = shares.reduce((sum, [, share]) => sum + share, 0);
  const models = shares.map(([model, share]) => {
    const ratio = share / shareTotal;
    const cost = costOf(model, { uncached: uncachedTokens * ratio, cached: cachedInputTokens * ratio, output: outputTokens * ratio });
    return { model, value: Math.round(tokens * ratio), costUsd: roundCents(cost), rawCost: cost };
  }).sort((left, right) => right.value - left.value);
  // 舍入的零头并进用量最大的型号：各型号相加要正好等于当天总量，否则图上会多出一截「其他」。
  models[0].value += tokens - models.reduce((sum, model) => sum + model.value, 0);
  const rawCost = models.reduce((sum, model) => sum + model.rawCost, 0);

  const threads = 1 + Math.floor(random() * profile.threads);
  const record = {
    day: isoDay(date),
    value: Math.round(uncachedTokens * weights.uncached + cachedInputTokens * weights.cached + outputTokens * weights.output),
    tokens,
    ioTokens: tokens - cachedInputTokens,
    inputTokens,
    cachedInputTokens,
    costUsd: roundCents(rawCost),
    unpricedTokens: 0,
    unpricedModels: [],
    threads,
    models: models.map(({ rawCost: _, ...model }) => model),
    projects: []
  };

  const projectRandom = random();
  if (age < WINDOW_DAYS) {
    const picked = pickProjects(random, profile.projects, Math.min(threads, 1 + Math.floor(projectRandom * 3)));
    const weightTotal = picked.reduce((sum, [, weight]) => sum + weight * (0.6 + random() * 0.8), 0) || 1;
    let remainingTokens = tokens;
    let remainingIo = record.ioTokens;
    let remainingCost = rawCost;
    record.projects = picked.map(([name, weight], index) => {
      const last = index === picked.length - 1;
      const ratio = last ? 1 : Math.min(1, (weight * (0.6 + random() * 0.8)) / weightTotal);
      const item = {
        name,
        tokens: last ? remainingTokens : Math.round(remainingTokens * ratio),
        ioTokens: last ? remainingIo : Math.round(remainingIo * ratio),
        costUsd: roundCents(last ? remainingCost : remainingCost * ratio),
        sessions: 1 + Math.floor(random() * 3)
      };
      remainingTokens -= item.tokens;
      remainingIo -= item.ioTokens;
      remainingCost = Math.max(0, remainingCost - item.costUsd);
      return item;
    }).sort((left, right) => right.tokens - left.tokens);
  } else {
    record.archived = true;
  }
  return record;
}

// 一天里每小时的用量（2.0.0，单日明细的按小时分布）：上午和下午两个高峰、晚上少一些、凌晨几乎没有。
// 用另一条随机序列（按种子和日期），不打乱上面各天的数值；今天只排到现在这个小时。
const HOUR_SHAPE = [0.2, 0.05, 0, 0, 0, 0, 0, 0.1, 0.5, 1.1, 1.6, 1.4, 0.7, 0.9, 1.5, 1.7, 1.5, 1.1, 0.6, 0.5, 0.8, 0.9, 0.7, 0.4];

function hoursOf(profile, record, { age, now }) {
  const random = mulberry32(profile.seed * 7919 + age * 104729);
  const lastHour = age === 0 ? new Date(now).getHours() : 23;
  const weights = HOUR_SHAPE.map((shape, hour) => (hour > lastHour ? 0 : shape * (0.4 + random() * 1.2) * (random() < 0.18 ? 0 : 1)));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const hours = weights.map((weight) => Math.round((record.tokens * weight) / total));
  // 舍入的零头并进最忙的一小时，24 个数相加正好是当天总量
  const peak = hours.indexOf(Math.max(...hours));
  hours[peak] += record.tokens - hours.reduce((sum, value) => sum + value, 0);
  return hours;
}

// 5 小时窗口（只有 Claude 有；GPT 不限 5 小时额度）：从每天第一次有用量的那个小时开窗，满 5 小时后
// 下一次有用量时再开一个；百分比按窗口里的用量折算，最后一个是正在进行的那个。
function fiveHourWindowsOf(profile, days, { now, current }) {
  const capacity = profile.tokensPerDay[1] * 0.42;
  const windows = [];
  let open = null;
  for (const day of days) {
    if (!day.hours) continue;
    const dayStart = new Date(`${day.day}T00:00:00`).getTime();
    const random = mulberry32(profile.seed * 31 + dayStart / DAY_MS);
    day.hours.forEach((tokens, hour) => {
      if (!(tokens > 0)) return;
      const at = dayStart + hour * HOUR_MS;
      if (!open || at >= open.endAt) {
        const startAt = at + Math.floor(random() * 40) * 60_000;
        open = { startAt, endAt: startAt + 5 * HOUR_MS, tokens: 0 };
        windows.push(open);
      }
      open.tokens += tokens;
    });
  }
  const past = windows
    .filter((item) => item.endAt <= current.startAt)
    .map((item) => ({ startAt: item.startAt, endAt: item.endAt, peak: Math.max(3, Math.min(100, Math.round((item.tokens / capacity) * 100))) }));
  return [...past, { startAt: current.startAt, endAt: current.endAt, peak: current.peak }].filter((item) => item.startAt < now);
}

// 周报（2.0.0）：上一个完整的自然周，按天的记录加起来，和 src/usage-recap.js 的结果同一个形状。
function topRows(map, limit, makeRow) {
  const sorted = [...map.values()].sort((left, right) => right.tokens - left.tokens);
  const rows = sorted.slice(0, limit).map(makeRow);
  const rest = sorted.slice(limit);
  if (rest.length) {
    rows.push({
      ...makeRow({ name: null, model: null, tokens: 0, costUsd: 0, sessions: 0 }),
      other: rest.length,
      tokens: rest.reduce((sum, item) => sum + item.tokens, 0),
      costUsd: roundCents(rest.reduce((sum, item) => sum + item.costUsd, 0))
    });
  }
  return rows;
}

function weeklyReportOf(days, { now, samples }) {
  const { startAt, endAt, previousStartAt } = lastCompleteWeek(now);
  const inRange = (from, to) => days.filter((day) => {
    const at = new Date(`${day.day}T00:00:00`).getTime();
    return at >= from && at < to;
  });
  const week = inRange(startAt, endAt);
  const hours = new Array(24).fill(0);
  const models = new Map();
  const projects = new Map();
  let busiestDay = null;
  for (const day of week) {
    if (!busiestDay || day.tokens > busiestDay.tokens) busiestDay = { day: day.day, tokens: day.tokens };
    (day.hours || []).forEach((value, hour) => { hours[hour] += value; });
    for (const model of day.models) {
      const item = models.get(model.model) || { model: model.model, tokens: 0, costUsd: 0 };
      item.tokens += model.value;
      item.costUsd += model.costUsd;
      models.set(model.model, item);
    }
    for (const project of day.projects) {
      const item = projects.get(project.name) || { name: project.name, tokens: 0, costUsd: 0, sessions: 0 };
      item.tokens += project.tokens;
      item.costUsd += project.costUsd;
      item.sessions += project.sessions;
      projects.set(project.name, item);
    }
  }
  const sum = (key) => week.reduce((total, day) => total + day[key], 0);
  const peakHour = Math.max(...hours);
  let quotaLow = null;
  for (const sample of samples) {
    if (sample.t >= startAt && sample.t < endAt && Number.isFinite(sample.week) && (!quotaLow || sample.week > quotaLow.usedPercent)) {
      quotaLow = { usedPercent: sample.week, at: sample.t };
    }
  }
  return {
    start: isoDay(new Date(startAt)),
    end: isoDay(new Date(endAt - 1)),
    previousStart: isoDay(new Date(previousStartAt)),
    tokens: sum('tokens'),
    ioTokens: sum('ioTokens'),
    inputTokens: sum('inputTokens'),
    cachedInputTokens: sum('cachedInputTokens'),
    costUsd: roundCents(sum('costUsd')),
    unpricedTokens: 0,
    sessions: sum('threads'),
    activeDays: week.filter((day) => day.tokens > 0).length,
    busiestDay,
    busiestHour: peakHour > 0 ? { hour: hours.indexOf(peakHour), tokens: peakHour } : null,
    models: topRows(models, 3, (item) => ({ model: item.model, tokens: item.tokens, costUsd: roundCents(item.costUsd) })),
    projects: topRows(projects, 3, (item) => ({ name: item.name, tokens: item.tokens, costUsd: roundCents(item.costUsd), sessions: item.sessions })),
    previousTokens: inRange(previousStartAt, startAt).reduce((total, day) => total + day.tokens, 0),
    quotaLow
  };
}

function generateDays(profile, { today, now }) {
  const random = mulberry32(profile.seed);
  const todayFraction = Math.min(1, Math.max(0.2, (now - today.getTime()) / DAY_MS));
  const days = [];
  for (let age = HISTORY_VIEW_DAYS - 1; age >= 0; age -= 1) {
    const date = addDays(today, -age);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const activeRoll = random();
    // 每天都先生成再决定要不要，随机序列不受“这天有没有用”影响。
    const record = buildDay(profile, random, { date, age, todayFraction });
    const vacation = age >= 214 && age <= 222;
    // 最近两周的工作日都有用量：截图里的 7 天柱状图和环比不会因为随机空几天显得奇怪。
    const recentWorkday = age < 14 && !weekend;
    const active = age === 0 || recentWorkday || (!vacation && activeRoll < (weekend ? 0.42 : 0.86));
    if (active) {
      if (age < WINDOW_DAYS) record.hours = hoursOf(profile, record, { age, now });
      days.push(record);
    }
  }
  return days;
}

// 某个时间段里的用量：按天累加，起点那天只算段内的那部分。
function summarizeWindow(days, { startAt, endAt, basis }) {
  const summary = { startAt, endAt, basis, tokens: 0, ioTokens: 0, inputTokens: 0, cachedInputTokens: 0, threads: 0 };
  const projects = new Map();
  let costUsd = 0;
  for (const day of days) {
    const dayStart = new Date(`${day.day}T00:00:00`).getTime();
    const overlap = Math.min(endAt, dayStart + DAY_MS) - Math.max(startAt, dayStart);
    if (overlap <= 0) continue;
    const ratio = Math.min(1, overlap / Math.min(DAY_MS, endAt - dayStart));
    for (const key of ['tokens', 'ioTokens', 'inputTokens', 'cachedInputTokens']) summary[key] += Math.round(day[key] * ratio);
    summary.threads += Math.max(1, Math.round(day.threads * ratio));
    costUsd += day.costUsd * ratio;
    for (const project of day.projects) {
      const item = projects.get(project.name) || { name: project.name, costUsd: 0, tokens: 0 };
      item.costUsd += project.costUsd * ratio;
      item.tokens += Math.round(project.tokens * ratio);
      projects.set(project.name, item);
    }
  }
  return { summary, projects: [...projects.values()].sort((left, right) => right.costUsd - left.costUsd), costUsd };
}

function attribution({ summary, projects, costUsd }) {
  const rows = projects.slice(0, ATTRIBUTION_PROJECTS).map((item) => ({ name: item.name, costUsd: round4(item.costUsd), tokens: item.tokens }));
  const rest = projects.slice(ATTRIBUTION_PROJECTS);
  if (rest.length) {
    rows.push({
      name: null,
      other: rest.length,
      costUsd: round4(rest.reduce((sum, item) => sum + item.costUsd, 0)),
      tokens: rest.reduce((sum, item) => sum + item.tokens, 0)
    });
  }
  return { costUsd: round4(costUsd), pricedTokens: summary.tokens, unpricedTokens: 0, projects: rows };
}

function activitySlice(provider, { today, now, fiveHour, week, samples, currentFive = null }) {
  const profile = PROFILES[provider];
  const all = generateDays(profile, { today, now });
  const cutoffDay = isoDay(addDays(today, -(WINDOW_DAYS - 1)));
  const days = all.filter((day) => day.day >= cutoffDay);
  const history = all.filter((day) => day.day < cutoffDay);
  const weekWindow = summarizeWindow(days, { ...week, endAt: now });
  return {
    status: 'ok',
    data: {
      source: profile.source,
      units: 'tokens',
      windowDays: WINDOW_DAYS,
      pricingAsOf: isoDay(today),
      pricingSource: 'litellm',
      windows: {
        fiveHour: summarizeWindow(days, { ...fiveHour, endAt: now }).summary,
        week: { ...weekWindow.summary, attribution: attribution(weekWindow) }
      },
      days,
      history: {
        status: 'ready',
        coverageStart: isoDay(addDays(today, -400)),
        days: history
      },
      weeklyReport: weeklyReportOf(days, { now, samples }),
      fiveHourWindows: currentFive ? fiveHourWindowsOf(profile, days, { now, current: currentFive }) : [],
      fiveHourUnlimited: !currentFive
    },
    error: null,
    errorCode: null,
    fetchedAt: now - 2 * 60_000,
    staleAfterMs: null,
    retryAt: null
  };
}

// 额度曲线的采样：一周的整点采样 + 最近一天十分钟一个点。
function quotaSamples(now, { weekResetAt, weekUsed, previousWeekUsed, fiveResetAt = null, fiveUsed = null }) {
  const samples = [];
  const cycleStart = weekResetAt - 7 * DAY_MS;
  const curve = (t) => {
    const week = t >= cycleStart
      ? Math.round(weekUsed * Math.min(1, (t - cycleStart) / (now - cycleStart)) ** 0.9)
      : Math.round(previousWeekUsed * (1 - (cycleStart - t) / (7 * DAY_MS)));
    let five = null;
    if (fiveResetAt !== null) {
      const cycleOffset = ((fiveResetAt - t) % (5 * HOUR_MS) + 5 * HOUR_MS) % (5 * HOUR_MS);
      five = Math.round(fiveUsed * (1 - cycleOffset / (5 * HOUR_MS)) * 1.3);
      five = Math.max(0, Math.min(100, five));
    }
    return { t, five, week: Math.max(0, Math.min(100, week)) };
  };
  for (let t = now - 7 * DAY_MS; t < now - DAY_MS; t += HOUR_MS) samples.push(curve(t));
  for (let t = now - DAY_MS; t <= now; t += 10 * 60_000) samples.push(curve(t));
  const last = samples[samples.length - 1];
  last.week = weekUsed;
  if (fiveResetAt !== null) last.five = fiveUsed;
  return samples;
}

function status(provider, now) {
  const components = provider === 'codex'
    ? ['Responses', 'Login', 'Codex in ChatGPT Desktop']
    : ['Claude API (api.anthropic.com)', 'Claude Code'];
  return {
    status: 'ok',
    data: {
      provider,
      level: 'none',
      components: components.map((name) => ({ name, status: 'operational', level: 'none' })),
      incidents: [],
      pageIndicator: 'none',
      pageDescription: 'All Systems Operational',
      home: provider === 'codex' ? 'https://status.openai.com/' : 'https://status.claude.com/'
    },
    error: null,
    errorCode: null,
    fetchedAt: now - 60_000,
    staleAfterMs: null,
    retryAt: null
  };
}

function main() {
  const { today, now } = parseArgs(process.argv.slice(2));
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'fixtures', 'qa-state.json'), 'utf8'));

  const codexWeekResetAt = now + Math.round(3.6 * DAY_MS);
  const claudeFiveResetAt = now + 2 * HOUR_MS + 10 * 60_000;
  const claudeWeekResetAt = now + Math.round(2.4 * DAY_MS);
  const usage = (data) => ({ status: 'ok', fetchedAt: now - 2 * 60_000, error: null, errorCode: null, staleAfterMs: null, retryAt: null, data });

  const usageHistory = {
    ...base.usageHistory,
    codex: quotaSamples(now, { weekResetAt: codexWeekResetAt, weekUsed: 37, previousWeekUsed: 74 }),
    claude: quotaSamples(now, { weekResetAt: claudeWeekResetAt, weekUsed: 56, previousWeekUsed: 81, fiveResetAt: claudeFiveResetAt, fiveUsed: 18 })
  };

  const state = {
    provider: 'codex',
    language: 'zh-CN',
    enabledProviders: ['codex', 'claude', 'kimi', 'glm', 'qwen'],
    usageHistory,
    usage: usage({
      planType: 'plus',
      limitReached: false,
      primaryWindow: null,
      secondaryWindow: { usedPercent: 37, remainingPercent: 63, resetAt: codexWeekResetAt },
      fiveHourUnlimited: true,
      resetCredits: {
        availableCount: 1,
        credits: [{ status: 'available', kind: 'full', expiresAt: new Date(now + 19 * DAY_MS).toISOString() }],
        error: null
      }
    }),
    radar: base.radar,
    tokenActivity: activitySlice('codex', {
      today,
      now,
      fiveHour: { startAt: now - 5 * HOUR_MS, basis: 'rolling' },
      week: { startAt: codexWeekResetAt - 7 * DAY_MS, basis: 'cycle' },
      samples: usageHistory.codex
    }),
    claudeUsage: usage({
      planType: 'Max 5x',
      limitReached: false,
      primaryWindow: { usedPercent: 18, remainingPercent: 82, resetAt: claudeFiveResetAt, inactive: false },
      secondaryWindow: { usedPercent: 56, remainingPercent: 44, resetAt: claudeWeekResetAt, inactive: false },
      extraWindows: [{ name: 'Fable', usedPercent: 13, remainingPercent: 87, resetAt: claudeWeekResetAt, inactive: false }]
    }),
    claudeRadar: base.claudeRadar,
    claudeActivity: activitySlice('claude', {
      today,
      now,
      fiveHour: { startAt: claudeFiveResetAt - 5 * HOUR_MS, basis: 'cycle' },
      week: { startAt: claudeWeekResetAt - 7 * DAY_MS, basis: 'cycle' },
      samples: usageHistory.claude,
      currentFive: { startAt: claudeFiveResetAt - 5 * HOUR_MS, endAt: claudeFiveResetAt, peak: 18 }
    }),
    codexStatus: status('codex', now),
    claudeStatus: status('claude', now),
    kimiUsage: base.kimiUsage,
    glmUsage: base.glmUsage,
    qwenUsage: base.qwenUsage
  };
  // 一周曲线用整点采样那一份（qa-render 会把所有采样平移到“现在”）。
  state.usageHistoryWeek = Object.fromEntries(Object.entries(state.usageHistory)
    .map(([provider, samples]) => [provider, samples.filter((sample, index) => index % 6 === 0 || sample.t < now - DAY_MS)]));
  process.stdout.write(`${JSON.stringify(state, null, 1)}\n`);
}

if (require.main === module) main();
else module.exports = { PROFILES, generateDays, isoDay, addDays };
