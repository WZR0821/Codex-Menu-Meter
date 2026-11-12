// Claude 官方接口返回值的纯解析逻辑：不读凭据、不发请求，方便单测。
//
// 用量接口 /api/oauth/usage 同时带着两种形状：
//   旧：five_hour / seven_day / seven_day_<名称>  → { utilization, resets_at }
//   新：limits[] → { kind: session | weekly_all | weekly_scoped, percent, resets_at, scope }
// 按模型划分的周限额（例如 Fable）现在只出现在 limits[] 里，seven_day_* 全是 null，
// 所以两边都要读，再按名称去重。
//
// 「重置卡」（官方客户端里的 /limit-reset）：请求带 ?cedar_ember=1 时，用量接口在 cedar_ember
// 字段里返回账号持有的可用重置。字段形状按官方客户端 2.1.321 的解析逻辑整理。
//
// 套餐以账户接口 /api/oauth/profile 为准。钥匙串里的 subscriptionType 是登录那一刻写下的，
// 之后升级或降级都不会变（本机 2026-11：实际 Max 5x，钥匙串里仍是 pro）。

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseClaudeTimestamp(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

// 两种形状的差别只在百分比字段名：旧的是 utilization，limits[] 里是 percent。
function normalizeClaudeWindow(windowValue) {
  if (!windowValue || typeof windowValue !== 'object') return null;
  const used = windowValue.utilization ?? windowValue.percent;
  const usedPercent = clamp(Math.round(Number(used ?? 0)) || 0, 0, 100);
  const resetAt = parseClaudeTimestamp(windowValue.resets_at);
  return {
    usedPercent,
    remainingPercent: clamp(100 - usedPercent, 0, 100),
    resetAt,
    inactive: !resetAt && usedPercent === 0
  };
}

function titleCase(value) {
  return String(value || '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function scopedLimitName(limit) {
  const scope = limit?.scope || {};
  const pick = (value) => (typeof value === 'string' ? value : value?.display_name || value?.id || '');
  return String(pick(scope.model) || pick(scope.surface) || '').trim();
}

function normalizeClaudeOfficialUsage(raw, { planType = null } = {}) {
  const limits = Array.isArray(raw?.limits) ? raw.limits.filter((limit) => limit && typeof limit === 'object') : [];
  const limitOfKind = (kind) => limits.find((limit) => limit.kind === kind);
  const primary = normalizeClaudeWindow(raw?.five_hour) || normalizeClaudeWindow(limitOfKind('session'));
  const secondary = normalizeClaudeWindow(raw?.seven_day) || normalizeClaudeWindow(limitOfKind('weekly_all'));
  if (!primary && !secondary) return null;

  const extraWindows = [];
  const seenNames = new Set();
  const addExtra = (windowValue, name) => {
    const window = normalizeClaudeWindow(windowValue);
    const key = name.toLowerCase();
    if (!window || seenNames.has(key)) return;
    seenNames.add(key);
    extraWindows.push({ ...window, name });
  };

  for (const [key, value] of Object.entries(raw || {})) {
    if (key === 'seven_day' || !key.startsWith('seven_day_')) continue;
    if (!value || typeof value !== 'object' || value.utilization === undefined) continue;
    addExtra(value, titleCase(key.slice('seven_day_'.length)));
  }
  for (const limit of limits) {
    if (limit.kind !== 'weekly_scoped') continue;
    addExtra(limit, scopedLimitName(limit));
  }

  return {
    planType,
    primaryWindow: primary,
    secondaryWindow: secondary,
    extraWindows,
    limitReached: [primary, secondary, ...extraWindows].some((item) => item && item.usedPercent >= 100),
    resetCredits: normalizeClaudeResetCredits(raw?.cedar_ember)
  };
}

const RESET_GRANT_KINDS = ['session', 'weekly', 'full'];

function normalizeClaudeResetGrant(grant, now) {
  if (!grant || typeof grant !== 'object') return null;
  const resetsLeft = Math.floor(Number(grant.resets_left));
  if (!Number.isFinite(resetsLeft) || resetsLeft < 0) return null;
  const resetsTotal = Math.max(resetsLeft, Math.floor(Number(grant.resets_total)) || 0);
  const expiresAt = parseClaudeTimestamp(grant.ends_at);
  // available：现在就能用；pending：留着，达到上限后才能用；其余是暂时用不了或已经失效。
  let status = 'unavailable';
  if (expiresAt && expiresAt <= now) status = 'expired';
  else if (resetsLeft === 0) status = 'redeemed';
  else if (grant.paused === true) status = 'paused';
  else if (grant.usable_now === true) status = 'available';
  else if (grant.use_requires_limit !== false) status = 'pending';
  return {
    status,
    title: String(grant.label || '').trim(),
    kind: RESET_GRANT_KINDS.includes(grant.type) ? grant.type : null,
    resetsLeft,
    resetsTotal,
    expiresAt
  };
}

// 返回形状与 Codex 的 resetCredits 对齐：{ availableCount, credits[], error }，
// 另带 unavailableReason（接口说明为什么这次没有给出重置卡，例如 surface / no_grant）。
function normalizeClaudeResetCredits(block, now = Date.now()) {
  if (!block || typeof block !== 'object') return null;
  const credits = (Array.isArray(block.grants) ? block.grants : [])
    .map((grant) => normalizeClaudeResetGrant(grant, now))
    .filter(Boolean);
  const held = credits.filter((credit) => credit.status === 'available' || credit.status === 'pending');
  return {
    availableCount: held.reduce((sum, credit) => sum + credit.resetsLeft, 0),
    credits,
    unavailableReason: block.eligible === true ? null : String(block.ineligible_reason || 'unknown'),
    error: null
  };
}

const PLAN_NAMES = {
  claude_max: 'Max',
  claude_pro: 'Pro',
  claude_team: 'Team',
  claude_enterprise: 'Enterprise',
  claude_free: 'Free'
};

// 返回界面上直接显示的套餐名，例如 "Max 5x"；账户接口拿不到时退回登录时记下的类型。
function resolveClaudePlan(profile, fallbackType = null) {
  const organization = profile?.organization || {};
  const account = profile?.account || {};
  const organizationType = String(organization.organization_type || '').toLowerCase();
  let plan = PLAN_NAMES[organizationType] || '';
  if (!plan && account.has_claude_max) plan = 'Max';
  if (!plan && account.has_claude_pro) plan = 'Pro';
  if (!plan && organizationType.startsWith('claude_')) plan = titleCase(organizationType.slice('claude_'.length));
  if (!plan) return fallbackType ? titleCase(fallbackType) : null;

  // Max 分 5x / 20x 两档，只有额度档位字段里带着倍数。
  const multiple = plan === 'Max' ? String(organization.rate_limit_tier || '').match(/max_(\d+)x/i) : null;
  return multiple ? `${plan} ${multiple[1]}x` : plan;
}

module.exports = {
  parseClaudeTimestamp,
  normalizeClaudeWindow,
  normalizeClaudeOfficialUsage,
  normalizeClaudeResetCredits,
  resolveClaudePlan
};
