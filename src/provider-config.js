(function initProviderConfig(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CMM_PROVIDERS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createProviderConfig() {
  const PROVIDERS = Object.freeze([
    Object.freeze({ id: 'codex', label: 'GPT', switchLabel: 'GPT', tag: 'GPT', optional: false, usageOnly: false }),
    // 2.1.0 起默认三栏：GPT、Claude、Google（用户定的顺序），新装也默认开着 Claude。
    Object.freeze({ id: 'claude', label: 'Claude', switchLabel: 'Claude', tag: 'CC', optional: true, usageOnly: false, defaultEnabled: true, hintKey: 'claudeHint' }),
    // 2.1.0：Google Antigravity。界面上叫 Google、简写 GA（用户定的）；内部 id 和设置键仍是 antigravity。
    // 和 GPT / Claude 一样有额度卡、曲线和 Token 活动；默认开启（老设置里没有这一项也按开启算）。
    Object.freeze({
      id: 'antigravity',
      label: 'Google',
      switchLabel: 'Google',
      tag: 'GA',
      optional: true,
      usageOnly: false,
      defaultEnabled: true,
      hintKey: 'antigravityHint'
    }),
    Object.freeze({
      id: 'kimi',
      label: 'Kimi Code',
      switchLabel: 'Kimi',
      tag: 'KM',
      optional: true,
      usageOnly: true,
      hintKey: 'kimiHint',
      apiKey: true,
      envKeys: ['KIMI_API_KEY', 'KIMI_CODING_API_KEY']
    }),
    Object.freeze({
      id: 'glm',
      label: 'GLM Coding Plan',
      switchLabel: 'GLM',
      tag: 'GLM',
      optional: true,
      usageOnly: true,
      hintKey: 'glmHint',
      apiKey: true,
      envKeys: ['GLM_API_KEY', 'ZHIPU_API_KEY']
    }),
    Object.freeze({
      id: 'qwen',
      label: 'Qwen Coding Plan',
      switchLabel: 'Qwen',
      tag: 'QW',
      optional: true,
      usageOnly: true,
      hintKey: 'qwenHint'
    })
  ]);

  const PROVIDER_BY_ID = Object.freeze(Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider])));
  const PROVIDER_IDS = Object.freeze(PROVIDERS.map((provider) => provider.id));
  const OPTIONAL_PROVIDER_IDS = Object.freeze(PROVIDERS.filter((provider) => provider.optional).map((provider) => provider.id));
  const USAGE_ONLY_PROVIDER_IDS = Object.freeze(PROVIDERS.filter((provider) => provider.usageOnly).map((provider) => provider.id));

  function defaultProviderSettings() {
    return Object.fromEntries(OPTIONAL_PROVIDER_IDS.map((id) => [id, { enabled: Boolean(PROVIDER_BY_ID[id].defaultEnabled), apiKey: '' }]));
  }

  function normalizeProviderSettings(value) {
    const explicit = value?.providerSettings && typeof value.providerSettings === 'object'
      ? value.providerSettings
      : null;
    const legacyExtras = value?.extraProviders && typeof value.extraProviders === 'object'
      ? value.extraProviders
      : {};

    return Object.fromEntries(OPTIONAL_PROVIDER_IDS.map((id) => {
      const provider = PROVIDER_BY_ID[id];
      const legacyEntry = id === 'claude' ? null : legacyExtras[id];
      const entry = explicit?.[id] || legacyEntry || {};
      // Claude was always visible before providerSettings existed, and since 2.1.0 the
      // default layout is GPT / Claude / Google: defaultEnabled providers start on
      // unless the user switched them off.
      const hasChoice = typeof entry.enabled === 'boolean';
      const enabled = provider.defaultEnabled && !hasChoice
        ? true
        : explicit
          ? Boolean(entry.enabled)
          : id === 'claude'
            ? true
            : Boolean(entry.enabled);
      return [id, {
        enabled,
        apiKey: provider.apiKey && typeof entry.apiKey === 'string' ? entry.apiKey.trim() : ''
      }];
    }));
  }

  function enabledProviderIds(providerSettings) {
    return PROVIDER_IDS.filter((id) => id === 'codex' || Boolean(providerSettings?.[id]?.enabled));
  }

  function normalizeProviderId(provider, providerSettings) {
    return enabledProviderIds(providerSettings).includes(provider) ? provider : 'codex';
  }

  function isProviderEnabled(provider, providerSettings) {
    return enabledProviderIds(providerSettings).includes(provider);
  }

  return {
    PROVIDERS,
    PROVIDER_BY_ID,
    PROVIDER_IDS,
    OPTIONAL_PROVIDER_IDS,
    USAGE_ONLY_PROVIDER_IDS,
    defaultProviderSettings,
    normalizeProviderSettings,
    enabledProviderIds,
    normalizeProviderId,
    isProviderEnabled
  };
});
