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
