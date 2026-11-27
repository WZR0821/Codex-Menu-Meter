const test = require('node:test');
const assert = require('node:assert/strict');

const {
  defaultProviderSettings,
  enabledProviderIds,
  normalizeProviderId,
  normalizeProviderSettings
} = require('../src/provider-config');

test('fresh settings show three columns: GPT, Claude, Google (2.1.0)', () => {
  const providerSettings = normalizeProviderSettings({
    providerSettings: defaultProviderSettings()
  });

  assert.deepEqual(enabledProviderIds(providerSettings), ['codex', 'claude', 'antigravity']);
});

test('Antigravity is on for upgrades that never saw it, but stays off once switched off', () => {
  const upgraded = normalizeProviderSettings({ providerSettings: { claude: { enabled: true } } });
  assert.equal(upgraded.antigravity.enabled, true);
  assert.deepEqual(enabledProviderIds(upgraded), ['codex', 'claude', 'antigravity']);

  const off = normalizeProviderSettings({ providerSettings: { antigravity: { enabled: false } } });
  assert.equal(off.antigravity.enabled, false);
  assert.equal(normalizeProviderId('antigravity', off), 'codex');
});

test('legacy settings preserve Claude visibility and extra provider values', () => {
  const providerSettings = normalizeProviderSettings({
    extraProviders: {
      kimi: { enabled: true, apiKey: '  kimi-key  ' },
      glm: { enabled: false, apiKey: 'glm-key' }
    }
  });

  assert.equal(providerSettings.claude.enabled, true);
  assert.deepEqual(providerSettings.kimi, { enabled: true, apiKey: 'kimi-key' });
  assert.equal(providerSettings.glm.apiKey, 'glm-key');
  assert.deepEqual(enabledProviderIds(providerSettings), ['codex', 'claude', 'antigravity', 'kimi']);
});

test('disabled or unknown active provider falls back to GPT', () => {
  const providerSettings = normalizeProviderSettings({
    providerSettings: {
      claude: { enabled: false },
      kimi: { enabled: true }
    }
  });

  assert.equal(normalizeProviderId('claude', providerSettings), 'codex');
  assert.equal(normalizeProviderId('kimi', providerSettings), 'kimi');
  assert.equal(normalizeProviderId('unknown', providerSettings), 'codex');
});
