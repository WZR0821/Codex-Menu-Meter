// 每日用量汇总落盘（2.0.0）。
// 本机日志不会一直留着（Claude Code 默认只留 30 天），要看 90 天、一年就得自己存每天的汇总。
// 每天按「模型 × 速度 × 提示长度档」存 token 分量（未缓存输入、5 分钟缓存写、1 小时缓存写、缓存读、输出、请求数），
// 费用不存，每次按当时的价格表重算：改价、价格表自动更新后，旧数据跟着按新价算。
const { componentsCostUsd, promptClassOf, entryPromptTokens } = require('./model-pricing');

const DAILY_STORE_VERSION = 1;
// 存两年多一点；界面目前最多用到近一年和它的前一段。
const DAILY_STORE_MAX_DAYS = 800;
const PROVIDERS = ['codex', 'claude'];

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function localIsoDate(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createDayAccumulator() {
  return { t: 0, io: 0, in: 0, ci: 0, w: 0, sessions: new Set(), models: new Map() };
}

// 分档键：s/f（标准 / 快速档）+ 提示长度档下界（千 token），如 s0、s272、f0。
function tierKey(entry) {
  return `${entry?.speed === 'fast' ? 'f' : 's'}${Math.round(promptClassOf(entryPromptTokens(entry)) / 1000)}`;
}

function addEntry(accumulator, entry) {
  accumulator.t += num(entry.tokens);
  accumulator.io += num(entry.ioTokens);
  accumulator.in += num(entry.inputTokens);
  accumulator.ci += num(entry.cachedInputTokens);
  accumulator.w += num(entry.weighted);
  if (entry.sessionId) accumulator.sessions.add(entry.sessionId);
  const model = String(entry.model || '?');
  let tiers = accumulator.models.get(model);
  if (!tiers) {
    tiers = {};
    accumulator.models.set(model, tiers);
  }
  const key = tierKey(entry);
  const parts = tiers[key] || (tiers[key] = [0, 0, 0, 0, 0, 0]);
  parts[0] += num(entry.baseInputTokens);
  parts[1] += num(entry.cacheWrite5mTokens);
  parts[2] += num(entry.cacheWrite1hTokens);
  parts[3] += num(entry.cachedInputTokens);
  parts[4] += num(entry.outputTokens);
  parts[5] += 1;
}

function finishDay(accumulator) {
  return {
    t: accumulator.t,
    io: accumulator.io,
    in: accumulator.in,
    ci: accumulator.ci,
    w: Math.round(accumulator.w),
    s: accumulator.sessions.size,
    m: Object.fromEntries(accumulator.models)
  };
}

// entries → { 'YYYY-MM-DD': 日记录 }，只收 [fromTs, toTs) 之间的条目（不传就不限）。
function buildDayRecords(entries, { fromTs = -Infinity, toTs = Infinity } = {}) {
  const days = new Map();
  for (const entry of entries || []) {
    const ts = Number(entry?.ts);
    if (!Number.isFinite(ts) || ts < fromTs || ts >= toTs) continue;
    const day = localIsoDate(ts);
    let accumulator = days.get(day);
    if (!accumulator) {
      accumulator = createDayAccumulator();
      days.set(day, accumulator);
    }
    addEntry(accumulator, entry);
  }
  return Object.fromEntries([...days].map(([day, accumulator]) => [day, finishDay(accumulator)]));
}

// 增量版：回填时一个文件一个文件地往里加，不必把全部条目留在内存里。
function createDayRecordBuilder() {
  const days = new Map();
  return {
    add(entry) {
      const ts = Number(entry?.ts);
      if (!Number.isFinite(ts)) return;
      const day = localIsoDate(ts);
      let accumulator = days.get(day);
      if (!accumulator) {
        accumulator = createDayAccumulator();
        days.set(day, accumulator);
      }
      addEntry(accumulator, entry);
    },
    finish() {
      return Object.fromEntries([...days].map(([day, accumulator]) => [day, finishDay(accumulator)]));
    }
  };
}

function emptyProviderStore() {
  return { backfilled: false, coverageStart: null, days: {} };
}

function normalizeStore(raw) {
  const store = { version: DAILY_STORE_VERSION, providers: {} };
  const sameVersion = raw?.version === DAILY_STORE_VERSION;
  for (const provider of PROVIDERS) {
    const source = raw?.providers?.[provider];
    const next = emptyProviderStore();
    if (source && typeof source === 'object') {
      for (const [day, record] of Object.entries(source.days || {})) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(day) && record && typeof record === 'object' && Number.isFinite(Number(record.t))) {
          next.days[day] = record;
        }
      }
      // 版本变了（汇总口径改过）：已存的天先留着，回填重跑一遍，能从日志重算的天以新算的为准。
      next.backfilled = sameVersion && source.backfilled === true;
      next.rebuild = !sameVersion;
      next.coverageStart = typeof source.coverageStart === 'string' ? source.coverageStart : null;
    }
    store.providers[provider] = next;
  }
  return store;
}

function earliestDay(days) {
  let earliest = null;
  for (const day of Object.keys(days)) {
    if (!earliest || day < earliest) earliest = day;
  }
  return earliest;
}

// 把新算出的日记录并进存储。日志会被清理（Claude Code 默认 30 天），所以新算的比已存的少时保留已存的；
// replace=true（口径升级后的重建）时以新算的为准。返回是否有变化。
function mergeDayRecords(providerStore, records, { replace = false } = {}) {
  let changed = false;
  for (const [day, record] of Object.entries(records || {})) {
    const stored = providerStore.days[day];
    if (stored && !replace && num(record.t) < num(stored.t)) continue;
    if (stored && JSON.stringify(stored) === JSON.stringify(record)) continue;
    providerStore.days[day] = record;
    changed = true;
  }
  const earliest = earliestDay(providerStore.days);
  if (earliest && (!providerStore.coverageStart || earliest < providerStore.coverageStart)) {
    providerStore.coverageStart = earliest;
    changed = true;
  }
  return changed;
}

function pruneStore(store, now = Date.now()) {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - DAILY_STORE_MAX_DAYS);
  const cutoffDay = localIsoDate(cutoff.getTime());
  for (const provider of PROVIDERS) {
    const days = store.providers[provider]?.days || {};
    for (const day of Object.keys(days)) {
      if (day < cutoffDay) delete days[day];
    }
  }
  return store;
}

function serializeStore(store) {
  const providers = {};
  for (const provider of PROVIDERS) {
    const source = store.providers[provider] || emptyProviderStore();
    providers[provider] = {
      backfilled: source.backfilled === true,
      coverageStart: source.coverageStart || null,
      days: source.days
    };
  }
  return JSON.stringify({ version: DAILY_STORE_VERSION, savedAt: Date.now(), providers });
}

function roundCents(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// 日记录 → 界面用的单日汇总（字段和按日志现算的那 30 天一致，只是没有项目拆分）。费用按当前价格表算。
function summarizeDayRecord(day, record) {
  let costUsd = 0;
  let unpricedTokens = 0;
  const unpricedModels = new Set();
  const models = [];
  for (const [model, tiers] of Object.entries(record.m || {})) {
    let tokens = 0;
    let cost = 0;
    let priced = model !== '?';
    for (const [key, parts] of Object.entries(tiers || {})) {
      if (!Array.isArray(parts)) continue;
      const [base, write5m, write1h, read, output] = parts.map(num);
      tokens += base + write5m + write1h + read + output;
      if (!priced) continue;
      const promptClass = Number(key.slice(1)) * 1000;
      const value = componentsCostUsd(model, { base, write5m, write1h, read, output }, {
        fast: key[0] === 'f',
        promptTokens: promptClass + 1
      });
      if (value === null) priced = false;
      else cost += value;
    }
    if (priced) costUsd += cost;
    else {
      unpricedTokens += tokens;
      unpricedModels.add(model);
    }
    if (model !== '?') models.push({ model, value: tokens, costUsd: priced ? roundCents(cost) : null });
  }
  models.sort((a, b) => b.value - a.value);
  return {
    day,
    value: num(record.w),
    tokens: num(record.t),
    ioTokens: num(record.io),
    inputTokens: num(record.in),
    cachedInputTokens: num(record.ci),
    costUsd: roundCents(costUsd),
    unpricedTokens,
    unpricedModels: [...unpricedModels],
    threads: num(record.s),
    models,
    projects: [],
    archived: true
  };
}

module.exports = {
  DAILY_STORE_VERSION,
  DAILY_STORE_MAX_DAYS,
  buildDayRecords,
  createDayRecordBuilder,
  mergeDayRecords,
  normalizeStore,
  pruneStore,
  serializeStore,
  summarizeDayRecord,
  localIsoDate
};
