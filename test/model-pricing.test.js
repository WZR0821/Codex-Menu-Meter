const test = require('node:test');
const assert = require('node:assert/strict');
const { priceForModel, entryCostUsd } = require('../src/model-pricing.js');

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
}

test('Fable 5.2 prices each token class separately', () => {
  const cost = entryCostUsd({
    model: 'claude-fable-5-2',
    baseInputTokens: 1e6,
    cacheWrite5mTokens: 1e6,
    cacheWrite1hTokens: 1e6,
    cachedInputTokens: 1e6,
    outputTokens: 1e6
  });
  close(cost, 8 + 10 + 16 + 0.2 + 40);
});

test('Opus 5.5 cache reads are 0.05x and fast mode doubles the rate', () => {
  const entry = { model: 'claude-opus-5-5', cachedInputTokens: 1e6, outputTokens: 1e6 };
  close(entryCostUsd(entry), 0.2 + 20);
  close(entryCostUsd({ ...entry, speed: 'fast' }), 2 * (0.2 + 20));
});

test('Haiku 5.5 switches to the long-prompt tier above 100K input', () => {
  close(entryCostUsd({ model: 'claude-haiku-5-5', baseInputTokens: 50_000, outputTokens: 0 }), 0.005);
  close(entryCostUsd({ model: 'claude-haiku-5-5', baseInputTokens: 200_000, outputTokens: 0 }), 0.1);
});

test('OpenAI models use cached-input prices and unknown models stay unpriced', () => {
  close(entryCostUsd({ model: 'gpt-6.1-sol', baseInputTokens: 1e6, cachedInputTokens: 1e6, outputTokens: 1e6 }), 2 + 0.1 + 10);
  close(entryCostUsd({ model: 'gpt-6-astra', baseInputTokens: 1e6 }), 10);
  assert.equal(entryCostUsd({ model: 'gpt-7-unknown', baseInputTokens: 1e6 }), null);
  assert.equal(entryCostUsd({ model: null, baseInputTokens: 1e6 }), null);
  assert.equal(priceForModel('claude-opus-4-1').input, 15);
  assert.equal(priceForModel('claude-opus-4-6').input, 5);
});

test('LiteLLM table keeps first-party chat models, validates prices and reads 272K tiers', () => {
  const { normalizeLiteLlmTable, setDynamicPrices, pricingInfo, componentsCostUsd, promptClassOf } = require('../src/model-pricing.js');
  const table = normalizeLiteLlmTable({
    'gpt-6.1-sol': {
      litellm_provider: 'openai', mode: 'chat',
      input_cost_per_token: 2e-6, output_cost_per_token: 1e-5, cache_read_input_token_cost: 1e-7,
      input_cost_per_token_above_272k_tokens: 4e-6, output_cost_per_token_above_272k_tokens: 1.5e-5,
      cache_read_input_token_cost_above_272k_tokens: 2e-7
    },
    'claude-opus-5-5': {
      litellm_provider: 'anthropic', mode: 'chat',
      input_cost_per_token: 4e-6, output_cost_per_token: 2e-5, cache_creation_input_token_cost: 5e-6,
      cache_creation_input_token_cost_above_1hr: 8e-6, cache_read_input_token_cost: 2e-7
    },
    'claude-haiku-5-5': {
      litellm_provider: 'anthropic', mode: 'chat',
      input_cost_per_token: 1e-7, output_cost_per_token: 5e-7, cache_read_input_token_cost: 1e-8
    },
    'gpt-9-preview': { litellm_provider: 'openai', mode: 'chat', input_cost_per_token: 3e-6, output_cost_per_token: 1.2e-5 },
    // 第三方托管、图片模型、价格明显不对的都不要。
    'anthropic.claude-opus-5-5': { litellm_provider: 'bedrock_converse', input_cost_per_token: 9e-6, output_cost_per_token: 9e-5 },
    'gpt-image-2': { litellm_provider: 'openai', mode: 'image_generation', input_cost_per_token: 5e-6, output_cost_per_token: 4e-5 },
    'gpt-broken': { litellm_provider: 'openai', mode: 'chat', input_cost_per_token: 2, output_cost_per_token: 1e-5 },
    'claude-free': { litellm_provider: 'anthropic', mode: 'chat', input_cost_per_token: 0, output_cost_per_token: 0 }
  });
  assert.deepEqual(Object.keys(table.models).sort(), ['claude-haiku-5-5', 'claude-opus-5-5', 'gpt-6.1-sol', 'gpt-9-preview']);
  assert.equal(normalizeLiteLlmTable({ nothing: {} }), null);

  setDynamicPrices({ ...table, fetchedAt: new Date(2026, 10, 23, 9).getTime() });
  try {
    assert.deepEqual(pricingInfo().source, 'litellm');
    assert.equal(pricingInfo().asOf, '2026-11-23');
    // 新型号只在 LiteLLM 里有：也能算。
    close(entryCostUsd({ model: 'gpt-9-preview', baseInputTokens: 1e6 }), 3);
    // 日期后缀、-codex 后缀都能对上；后面紧跟版本号的不算同一个型号。
    close(entryCostUsd({ model: 'gpt-6.1-sol-2026-09-29', outputTokens: 1e6 }), 10);
    close(entryCostUsd({ model: 'gpt-6.1-sol-codex', outputTokens: 1e6 }), 10);
    assert.equal(entryCostUsd({ model: 'gpt-9-preview-2', baseInputTokens: 1e6 }), null);
    // 超过 272K 的请求按高档计价。
    close(entryCostUsd({ model: 'gpt-6.1-sol', baseInputTokens: 300_000, cachedInputTokens: 0, outputTokens: 0 }), 300_000 * 4 / 1e6);
    close(entryCostUsd({ model: 'gpt-6.1-sol', baseInputTokens: 100_000 }), 0.2);
    // 内置表的快速档倍率和 Haiku 100K 分档在命中 LiteLLM 时仍然生效。
    close(entryCostUsd({ model: 'claude-opus-5-5', outputTokens: 1e6, speed: 'fast' }), 40);
    close(entryCostUsd({ model: 'claude-haiku-5-5', baseInputTokens: 200_000 }), 0.1);
    // 每日汇总按档存：档的下界 + 1 当作提示长度，得到和逐条计价一样的档位。
    assert.equal(promptClassOf(300_000), 272_000);
    assert.equal(promptClassOf(100_000), 0);
    close(componentsCostUsd('gpt-6.1-sol', { base: 1e6 }, { promptTokens: promptClassOf(300_000) + 1 }), 4);
  } finally {
    setDynamicPrices(null);
  }
  assert.equal(pricingInfo().source, 'builtin');
  assert.equal(entryCostUsd({ model: 'gpt-9-preview', baseInputTokens: 1e6 }), null);
});
