// 按模型的 API 牌价估算本机记录的「等价 API 费用」。订阅用户并不按这个付费，
// 界面上只作参考；没有官方价的型号返回 null，由界面标成「未定价」，不拿通用价凑数。
//
// 价格（美元 / 百万 token），2026-11-13 核对：
//   Claude：Anthropic 官方模型资料（输入 / 5 分钟缓存写 / 1 小时缓存写 / 缓存读 / 输出）
//   OpenAI：developers.openai.com/api/docs/pricing 标准档、短上下文（≤272K 输入）
// 价格会变：改表时同步更新 PRICING_AS_OF 和对应单测。

const PRICING_AS_OF = '2026-11-13';

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
  [/^claude-haiku-5-5/i, { ...claude(0.1, 0.5, 0.1), longPrompt: { above: 100_000, ...claude(0.5, 2.5, 0.1) } }],
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

function priceForModel(model) {
  const name = String(model || '').trim();
  if (!name) return null;
  for (const [pattern, price] of MODEL_PRICES) {
    if (pattern.test(name)) return price;
  }
  return null;
}

// entry 字段（两个解析器都会给）：
//   baseInputTokens  未缓存、也不写缓存的输入
//   cacheWrite5mTokens / cacheWrite1hTokens  写入缓存（只有 Claude 有）
//   cachedInputTokens  缓存读
//   outputTokens
//   speed  'fast' 时按该型号的快速档倍率（只对有官方倍率的型号生效）
function entryCostUsd(entry) {
  let price = priceForModel(entry?.model);
  if (!price) return null;
  const base = Number(entry.baseInputTokens) || 0;
  const write5m = Number(entry.cacheWrite5mTokens) || 0;
  const write1h = Number(entry.cacheWrite1hTokens) || 0;
  const read = Number(entry.cachedInputTokens) || 0;
  const output = Number(entry.outputTokens) || 0;
  if (price.longPrompt && base + write5m + write1h + read > price.longPrompt.above) price = price.longPrompt;
  const multiplier = entry.speed === 'fast' && price.fastMultiplier ? price.fastMultiplier : 1;
  const dollars = (
    base * price.input
    + write5m * price.cacheWrite5m
    + write1h * price.cacheWrite1h
    + read * price.cacheRead
    + output * price.output
  ) / 1e6;
  return dollars * multiplier;
}

module.exports = { PRICING_AS_OF, MODEL_PRICES, priceForModel, entryCostUsd };
