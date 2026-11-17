const CODEX_BUNDLE_IDS = new Set([
  'com.openai.codex'
]);

const CLAUDE_BUNDLE_IDS = new Set([
  'com.anthropic.claudefordesktop'
]);

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function detectForegroundProvider({ bundleId, name, bundlePath } = {}) {
  const id = normalize(bundleId);
  if (CODEX_BUNDLE_IDS.has(id)) return 'codex';
  if (CLAUDE_BUNDLE_IDS.has(id)) return 'claude';

  const appName = normalize(name);
  if (appName === 'codex' || appName === 'chatgpt') return 'codex';
  if (appName === 'claude' || appName === 'claude code') return 'claude';

  const appBundle = normalize(bundlePath).match(/\/([^/]+)\.app(?:\/|$)/)?.[1] || '';
  if (appBundle === 'codex' || appBundle === 'chatgpt') return 'codex';
  if (appBundle === 'claude' || appBundle === 'claude code') return 'claude';
  return null;
}

function normalizeApplication(identity = {}) {
  return {
    bundleId: String(identity.bundleId || '').trim(),
    name: String(identity.name || '').trim(),
    bundlePath: String(identity.bundlePath || '').trim(),
    pid: String(identity.pid || '').trim()
  };
}

function applicationKey(identity) {
  if (!identity) return null;
  return [
    identity.bundleId,
    identity.name,
    identity.bundlePath,
    identity.pid
  ].join('\t');
}

class ForegroundProviderTracker {
  constructor() {
    this.application = null;
    this.applicationKey = null;
    this.manualOverrideKey = null;
  }

  update(identity) {
    const application = normalizeApplication(identity);
    const nextKey = applicationKey(application);
    if (nextKey !== this.applicationKey) {
      this.applicationKey = nextKey;
      this.manualOverrideKey = null;
    }
    this.application = application;
  }

  markManualOverride() {
    if (this.applicationKey) this.manualOverrideKey = this.applicationKey;
  }

  clearManualOverride() {
    this.manualOverrideKey = null;
  }

  recommendedProvider() {
    if (!this.application || this.manualOverrideKey === this.applicationKey) return null;
    return detectForegroundProvider(this.application);
  }
}

module.exports = {
  ForegroundProviderTracker,
  detectForegroundProvider
};
