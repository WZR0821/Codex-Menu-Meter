const test = require('node:test');
const assert = require('node:assert/strict');

const {
  defaultProviderSettings,
  enabledProviderIds,
  normalizeProviderId,
  normalizeProviderSettings
} = require('../src/provider-config');

test('fresh settings expose only GPT', () => {
  const providerSettings = normalizeProviderSettings({
    providerSettings: defaultProviderSettings()
  });

  assert.deepEqual(enabledProviderIds(providerSettings), ['codex']);
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
  assert.deepEqual(enabledProviderIds(providerSettings), ['codex', 'claude', 'kimi']);
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
