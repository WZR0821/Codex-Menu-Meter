// 按模型的 API 牌价估算本机记录的「等价 API 费用」。订阅用户并不按这个付费，
// 界面上只作参考；没有价格的型号返回 null，由界面标成「未定价」，不拿通用价凑数。
//
// 价格（美元 / 百万 token）有两个来源（2.0.0 起）：
//   1. LiteLLM 公开的价格表（model_prices_and_context_window.json），主进程每天拉一次、校验后缓存，见 setDynamicPrices；
//   2. 下面的内置表（2026-11-13 按 Anthropic、OpenAI 官方价格页核对），拉不到或某型号不在 LiteLLM 里时兜底。
// 快速档倍率（Opus fast）和 LiteLLM 没写的分档（Haiku 5.5 的 100K 档）只有内置表有，命中 LiteLLM 时也保留。

const PRICING_AS_OF = '2026-11-13';

// 按单次请求的提示长度分档的门槛。每日汇总按这些档存 token 分量，改价后旧数据也能按档重算。
const PROMPT_CLASSES = [0, 100_000, 128_000, 200_000, 272_000];

function claude(input, output, cacheReadRatio, extra = {}) {
  return {
    input,
    output,
    cacheWrite5m: input * 1.25,
    cacheWrite1h: input * 2,
    cacheRead: input * cacheReadRatio,
    ...extra
  };
}

function openai(input, cachedInput, output) {
  return { input, output, cacheRead: cachedInput, cacheWrite5m: 0, cacheWrite1h: 0 };
}

// 顺序有意义：更具体的型号写在前面。
const MODEL_PRICES = [
  [/^claude-(fable|mythos)-5-2/i, claude(8, 40, 0.025)],
  [/^claude-(fable|mythos)-5-1/i, claude(10, 50, 0.025)],
  [/^claude-(fable|mythos)-5(?!-\d)/i, claude(10, 50, 0.1)],
  [/^claude-opus-5-5/i, claude(4, 20, 0.05, { fastMultiplier: 2 })],
  [/^claude-opus-5(?!-\d)/i, claude(5, 25, 0.1, { fastMultiplier: 2 })],
  [/^claude-opus-4-8/i, claude(5, 25, 0.1, { fastMultiplier: 2 })],
  [/^claude-opus-4-(5|6|7)/i, claude(5, 25, 0.1)],
  [/^claude-opus-4/i, claude(15, 75, 0.1)],
  [/^claude-sonnet-5-5/i, claude(2, 10, 0.05)],
  [/^claude-sonnet-5(?!-\d)/i, claude(2, 10, 0.1)],
  [/^claude-sonnet-4/i, claude(3, 15, 0.1)],
  // Haiku 5.5 按单次请求的提示长度分两档：≤100K 一档，超过另一档。
  [/^claude-haiku-5-5/i, { ...claude(0.1, 0.5, 0.1), tiers: [{ above: 100_000, ...claude(0.5, 2.5, 0.1) }] }],
  [/^claude-haiku-4-5/i, claude(1, 5, 0.1)],
  [/^gpt-6-astra/i, openai(10, 1, 50)],
  [/^gpt-6\.1-sol/i, openai(2, 0.1, 10)],
  [/^gpt-6\.1-terra/i, openai(1, 0.05, 5)],
  [/^gpt-6-sol/i, openai(2, 0.2, 10)],
  [/^gpt-6-luna/i, openai(0.1, 0.01, 0.5)],
  [/^gpt-5\.6-sol/i, openai(4, 0.4, 20)],
  [/^gpt-5\.6-terra/i, openai(2, 0.2, 12)],
  [/^gpt-5\.6-luna/i, openai(0.2, 0.02, 1.2)]
];

let dynamicPrices = null;

function builtinPriceFor(name) {
  for (const [pattern, price] of MODEL_PRICES) {
    if (pattern.test(name)) return price;
  }
  return null;
}

function normalizeModelName(model) {
  return String(model || '')
    .trim()
    .toLowerCase()
    .replace(/\[[^\]]*\]$/, '')
    .replace(/-(\d{8}|\d{4}-\d{2}-\d{2})$/, '');
}

// LiteLLM 表里按名字找：先精确，再去掉日期等后缀，最后取「最长的前缀 + 字母开头的后缀」（如 -codex、-latest）。
// 前缀后面紧跟数字的不算（claude-opus-5 不能冒充 claude-opus-5-7）。
function dynamicPriceFor(name) {
  const models = dynamicPrices?.models;
  if (!models) return null;
  const raw = String(name || '').trim().toLowerCase();
  if (models[raw]) return models[raw];
  const normalized = normalizeModelName(raw);
  if (models[normalized]) return models[normalized];
  let best = null;
  for (const key of Object.keys(models)) {
    if (normalized.length <= key.length || !normalized.startsWith(key)) continue;
    if (!/^-[a-z]/.test(normalized.slice(key.length))) continue;
    if (!best || key.length > best.length) best = key;
  }
  return best ? models[best] : null;
}

function priceForModel(model) {
  const name = String(model || '').trim();
  if (!name) return null;
  const builtin = builtinPriceFor(name);
  const dynamic = dynamicPriceFor(name);
  if (!dynamic) return builtin;
  if (!builtin) return dynamic;
  return {
    ...dynamic,
    ...(builtin.fastMultiplier ? { fastMultiplier: builtin.fastMultiplier } : {}),
    ...(!dynamic.tiers?.length && builtin.tiers?.length ? { tiers: builtin.tiers } : {})
  };
}

function promptClassOf(promptTokens) {
  const value = Number(promptTokens) || 0;
  let result = 0;
  for (const threshold of PROMPT_CLASSES) {
    if (value > threshold) result = threshold;
  }
  return result;
}

function tierFor(price, promptTokens) {
  let chosen = price;
  for (const tier of price.tiers || []) {
    if (promptTokens > tier.above) chosen = tier;
  }
  return chosen;
}

// components：base 未缓存输入、write5m / write1h 写缓存（只有 Claude 有）、read 缓存读、output 输出。
// promptTokens 决定分档；fast 时按该型号的快速档倍率（只对有官方倍率的型号生效）。
function componentsCostUsd(model, components, { fast = false, promptTokens = 0 } = {}) {
  const price = priceForModel(model);
  if (!price) return null;
  const tier = tierFor(price, Number(promptTokens) || 0);
  const multiplier = fast && price.fastMultiplier ? price.fastMultiplier : 1;
  const dollars = (
    (Number(components.base) || 0) * tier.input
    + (Number(components.write5m) || 0) * (tier.cacheWrite5m ?? price.cacheWrite5m ?? 0)
    + (Number(components.write1h) || 0) * (tier.cacheWrite1h ?? price.cacheWrite1h ?? 0)
    + (Number(components.read) || 0) * (tier.cacheRead ?? price.cacheRead ?? 0)
    + (Number(components.output) || 0) * tier.output
  ) / 1e6;
  return dollars * multiplier;
}

function entryComponents(entry) {
  return {
    base: Number(entry?.baseInputTokens) || 0,
    write5m: Number(entry?.cacheWrite5mTokens) || 0,
    write1h: Number(entry?.cacheWrite1hTokens) || 0,
    read: Number(entry?.cachedInputTokens) || 0,
    output: Number(entry?.outputTokens) || 0
  };
}

function entryPromptTokens(entry) {
  const parts = entryComponents(entry);
  return parts.base + parts.write5m + parts.write1h + parts.read;
}

// entry 字段（两个解析器都会给）：baseInputTokens、cacheWrite5mTokens / cacheWrite1hTokens、
// cachedInputTokens、outputTokens、speed（'fast' 时按快速档倍率）。
function entryCostUsd(entry) {
  return componentsCostUsd(entry?.model, entryComponents(entry), {
    fast: entry?.speed === 'fast',
    promptTokens: entryPromptTokens(entry)
  });
}

// ---- LiteLLM 价格表 ----

const LITELLM_PROVIDERS = new Set(['anthropic', 'openai']);
const LITELLM_MODES = new Set(['chat', 'responses']);
const LITELLM_NAME = /^(claude|gpt|o\d|codex|chatgpt)[\w.-]*$/i;

function perMillion(value) {
  const number = Number(value);
  return value !== undefined && value !== null && Number.isFinite(number) && number >= 0 ? number * 1e6 : null;
}

function plausible(price) {
  const values = [price.input, price.output, price.cacheRead, price.cacheWrite5m, price.cacheWrite1h];
  if (!values.every((value) => Number.isFinite(value) && value >= 0)) return false;
  // 每百万 token：输入 0–500 美元、输出 0–2000 美元，缓存读不比输入贵。超出就当数据有误，不用。
  return price.input > 0 && price.input <= 500 && price.output > 0 && price.output <= 2000
    && price.cacheRead <= price.input * 1.01;
}

function litellmEntryToPrice(entry) {
  const input = perMillion(entry.input_cost_per_token);
  const output = perMillion(entry.output_cost_per_token);
  if (input === null || output === null) return null;
  const anthropic = entry.litellm_provider === 'anthropic';
  const price = {
    input,
    output,
    cacheRead: perMillion(entry.cache_read_input_token_cost) ?? input,
    cacheWrite5m: perMillion(entry.cache_creation_input_token_cost) ?? (anthropic ? input * 1.25 : 0),
    cacheWrite1h: perMillion(entry.cache_creation_input_token_cost_above_1hr) ?? (anthropic ? input * 2 : 0)
  };
  if (!plausible(price)) return null;
  const tiers = [];
  for (const key of Object.keys(entry)) {
    const match = /^input_cost_per_token_above_(\d+)k_tokens$/.exec(key);
    if (!match) continue;
    const suffix = `above_${match[1]}k_tokens`;
    const tierInput = perMillion(entry[key]);
    if (tierInput === null) continue;
    const ratio = tierInput / input;
    const tier = {
      above: Number(match[1]) * 1000,
      input: tierInput,
      output: perMillion(entry[`output_cost_per_token_${suffix}`]) ?? output,
      cacheRead: perMillion(entry[`cache_read_input_token_cost_${suffix}`]) ?? price.cacheRead * ratio,
      cacheWrite5m: perMillion(entry[`cache_creation_input_token_cost_${suffix}`]) ?? price.cacheWrite5m * ratio,
      cacheWrite1h: perMillion(entry[`cache_creation_input_token_cost_above_1hr_${suffix}`]) ?? price.cacheWrite1h * ratio
    };
    if (plausible(tier)) tiers.push(tier);
  }
  if (tiers.length) price.tiers = tiers.sort((a, b) => a.above - b.above);
  return price;
}

// 从整份 LiteLLM 表（约 5 MB、七千多条）里挑出 Anthropic / OpenAI 一方的对话型号，逐条校验，
// 只留几十条存起来。返回 { models: { 名字: 价格 } }；一条都不剩时返回 null。
// 返回 { models, entries }：models 是换算好的价格，entries 是原表里用得上的那部分（只留价格字段），
// 落盘缓存存 entries，下次启动重新走一遍这里的校验，校验规则改了也不会沿用旧结果。
function normalizeLiteLlmTable(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const models = {};
  const entries = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object' || !LITELLM_NAME.test(name)) continue;
    if (!LITELLM_PROVIDERS.has(entry.litellm_provider)) continue;
    if (entry.mode && !LITELLM_MODES.has(entry.mode)) continue;
    const price = litellmEntryToPrice(entry);
    if (!price) continue;
    models[name.toLowerCase()] = price;
    const kept = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'litellm_provider' || key === 'mode' || /_cost(?:_|$)/.test(key)) kept[key] = value;
    }
    entries[name] = kept;
  }
  return Object.keys(models).length ? { models, entries } : null;
}

// table：normalizeLiteLlmTable 的结果，加上 fetchedAt（毫秒）。传 null 退回只用内置表。
function setDynamicPrices(table) {
  dynamicPrices = table?.models && Object.keys(table.models).length ? table : null;
}

function localIsoDate(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function pricingInfo() {
  if (dynamicPrices && Number.isFinite(Number(dynamicPrices.fetchedAt))) {
    return { source: 'litellm', asOf: localIsoDate(Number(dynamicPrices.fetchedAt)), models: Object.keys(dynamicPrices.models).length };
  }
  return { source: 'builtin', asOf: PRICING_AS_OF, models: MODEL_PRICES.length };
}

module.exports = {
  PRICING_AS_OF,
  PROMPT_CLASSES,
  MODEL_PRICES,
  priceForModel,
  promptClassOf,
  componentsCostUsd,
  entryCostUsd,
  entryPromptTokens,
  normalizeLiteLlmTable,
  setDynamicPrices,
  pricingInfo
};
