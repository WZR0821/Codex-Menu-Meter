const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseClaudeTimestamp,
  normalizeClaudeOfficialUsage,
  normalizeClaudeResetCredits,
  resolveClaudePlan
} = require('../src/claude-usage');

// 2026-11-12 本机实测返回值的精简版：seven_day_* 全是 null，Fable 的周限额只在 limits[] 里。
const LIVE_USAGE = {
  five_hour: { utilization: 30, resets_at: '2026-11-12T04:50:00.891661+00:00' },
  seven_day: { utilization: 4, resets_at: '2026-11-18T12:00:00.891686+00:00' },
  seven_day_opus: null,
  seven_day_sonnet: null,
  extra_usage: { is_enabled: false, utilization: null },
  limits: [
    { kind: 'session', group: 'session', percent: 30, resets_at: '2026-11-12T04:50:00.891661+00:00', scope: null },
    { kind: 'weekly_all', group: 'weekly', percent: 4, resets_at: '2026-11-18T12:00:00.891686+00:00', scope: null },
    {
      kind: 'weekly_scoped',
      group: 'weekly',
      percent: 5,
      resets_at: '2026-11-18T11:59:59.891851+00:00',
      scope: { model: { id: null, display_name: 'Fable' }, surface: null }
    }
  ]
};

test('按模型划分的周限额从 limits[] 读出来', () => {
  const usage = normalizeClaudeOfficialUsage(LIVE_USAGE, { planType: 'Max 5x' });
  assert.equal(usage.planType, 'Max 5x');
  assert.equal(usage.primaryWindow.usedPercent, 30);
  assert.equal(usage.primaryWindow.remainingPercent, 70);
  assert.equal(usage.primaryWindow.resetAt, Date.parse('2026-11-12T04:50:00.891661+00:00'));
  assert.equal(usage.secondaryWindow.usedPercent, 4);
  assert.deepEqual(usage.extraWindows.map((item) => [item.name, item.usedPercent]), [['Fable', 5]]);
  assert.equal(usage.extraWindows[0].resetAt, Date.parse('2026-11-18T11:59:59.891851+00:00'));
  assert.equal(usage.limitReached, false);
});

test('旧形状 seven_day_<名称> 仍然生效，并与 limits[] 里的同名项去重', () => {
  const usage = normalizeClaudeOfficialUsage({
    ...LIVE_USAGE,
    seven_day_opus: { utilization: 61, resets_at: '2026-11-18T12:00:00+00:00' },
    seven_day_oauth_apps: { utilization: 2, resets_at: null },
    limits: [
      ...LIVE_USAGE.limits,
      { kind: 'weekly_scoped', percent: 60, resets_at: '2026-11-18T12:00:00+00:00', scope: { model: { display_name: 'Opus' } } }
    ]
  });
  assert.deepEqual(usage.extraWindows.map((item) => [item.name, item.usedPercent]), [
    ['Opus', 61],
    ['Oauth Apps', 2],
    ['Fable', 5]
  ]);
});

test('只有 limits[] 时也能得到 5 小时和周窗口', () => {
  const usage = normalizeClaudeOfficialUsage({ limits: LIVE_USAGE.limits });
  assert.equal(usage.primaryWindow.usedPercent, 30);
  assert.equal(usage.secondaryWindow.usedPercent, 4);
  assert.equal(usage.planType, null);
});

test('两个主窗口都没有时返回 null，交给调用方报「数据异常」', () => {
  assert.equal(normalizeClaudeOfficialUsage({}), null);
  assert.equal(normalizeClaudeOfficialUsage(null), null);
  assert.equal(normalizeClaudeOfficialUsage({ limits: [LIVE_USAGE.limits[2]] }), null);
});

test('未开始计时的窗口标记为 inactive，用满任一窗口即 limitReached', () => {
  const idle = normalizeClaudeOfficialUsage({ five_hour: { utilization: 0, resets_at: null }, seven_day: { utilization: 12, resets_at: '2026-11-18T12:00:00+00:00' } });
  assert.equal(idle.primaryWindow.inactive, true);
  assert.equal(idle.secondaryWindow.inactive, false);

  const capped = normalizeClaudeOfficialUsage({
    ...LIVE_USAGE,
    limits: [{ kind: 'weekly_scoped', percent: 100, resets_at: '2026-11-18T12:00:00+00:00', scope: { model: { display_name: 'Fable' } } }]
  });
  assert.equal(capped.limitReached, true);
});

test('套餐以账户接口为准，不受钥匙串里的旧值影响', () => {
  // 本机 2026-11-12：钥匙串写的是 pro，账户接口是 Max 5x。
  const profile = {
    account: { has_claude_max: true, has_claude_pro: false },
    organization: { organization_type: 'claude_max', rate_limit_tier: 'default_claude_max_5x' }
  };
  assert.equal(resolveClaudePlan(profile, 'pro'), 'Max 5x');
  assert.equal(resolveClaudePlan({ organization: { organization_type: 'claude_max', rate_limit_tier: 'default_claude_max_20x' } }), 'Max 20x');
  assert.equal(resolveClaudePlan({ organization: { organization_type: 'claude_max' } }), 'Max');
  assert.equal(resolveClaudePlan({ organization: { organization_type: 'claude_pro', rate_limit_tier: 'default_claude_ai' } }, 'max'), 'Pro');
  assert.equal(resolveClaudePlan({ organization: { organization_type: 'claude_team' } }), 'Team');
  assert.equal(resolveClaudePlan({ account: { has_claude_max: true }, organization: {} }), 'Max');
  assert.equal(resolveClaudePlan({ organization: { organization_type: 'claude_something_new' } }), 'Something New');
});

test('账户接口读不到时退回登录时记下的类型', () => {
  assert.equal(resolveClaudePlan(null, 'pro'), 'Pro');
  assert.equal(resolveClaudePlan({}, 'max'), 'Max');
  assert.equal(resolveClaudePlan(null, null), null);
});

test('时间戳：秒、毫秒、ISO 字符串都能解析', () => {
  assert.equal(parseClaudeTimestamp(1_794_459_000), 1_794_459_000_000);
  assert.equal(parseClaudeTimestamp(1_794_459_000_000), 1_794_459_000_000);
  assert.equal(parseClaudeTimestamp('2026-11-12T04:50:00+00:00'), Date.parse('2026-11-12T04:50:00+00:00'));
  assert.equal(parseClaudeTimestamp(''), null);
  assert.equal(parseClaudeTimestamp('not a date'), null);
});

// 字段形状取自官方客户端 2.1.321 对 cedar_ember 状态块的解析。
const NOW = Date.parse('2026-11-12T02:00:00Z');

test('重置卡：按可用、待用、暂停、用完、过期分类，可用数量只算还留着的', () => {
  const credits = normalizeClaudeResetCredits({
    eligible: true,
    ineligible_reason: null,
    grants: [
      { id: 'g1', label: 'Full reset', type: 'full', resets_total: 2, resets_left: 1, ends_at: '2026-12-01T22:15:13Z', usable_now: true },
      { id: 'g2', label: '', type: 'session', resets_total: 3, resets_left: 2, ends_at: '2026-11-30T00:00:00Z', usable_now: false, use_requires_limit: true },
      { id: 'g3', label: 'Weekly reset', type: 'weekly', resets_total: 1, resets_left: 1, ends_at: null, paused: true },
      { id: 'g4', label: 'Fable reset', resets_total: 1, resets_left: 0, ends_at: '2026-11-30T00:00:00Z' },
      { id: 'g5', label: 'Old reset', type: 'full', resets_total: 1, resets_left: 1, ends_at: '2026-11-01T00:00:00Z', usable_now: true },
      { id: 'g6', label: 'Blocked', type: 'weekly', resets_total: 1, resets_left: 1, usable_now: false, use_requires_limit: false },
      { id: 'bad', label: 'no count' },
      null
    ]
  }, NOW);
  assert.deepEqual(credits.credits.map((item) => [item.title, item.kind, item.status, item.resetsLeft, item.resetsTotal]), [
    ['Full reset', 'full', 'available', 1, 2],
    ['', 'session', 'pending', 2, 3],
    ['Weekly reset', 'weekly', 'paused', 1, 1],
    ['Fable reset', null, 'redeemed', 0, 1],
    ['Old reset', 'full', 'expired', 1, 1],
    ['Blocked', 'weekly', 'unavailable', 1, 1]
  ]);
  assert.equal(credits.availableCount, 3);
  assert.equal(credits.credits[0].expiresAt, Date.parse('2026-12-01T22:15:13Z'));
  assert.equal(credits.credits[2].expiresAt, null);
  assert.equal(credits.unavailableReason, null);
  assert.equal(credits.error, null);
  // 兑换用的 id 不进状态，界面和手机同步都用不到。
  assert.equal('id' in credits.credits[0], false);
});

test('重置卡：接口说明不提供时保留原因码', () => {
  // 本机 2026-11-12 实测：本应用的请求得到 eligible=false、reason=surface、grants 为空。
  const withheld = normalizeClaudeResetCredits({
    eligible: false, ineligible_reason: 'surface', at_limit: false, exhausted: [], grants: [], next_grant_id: null
  }, NOW);
  assert.deepEqual(withheld, { availableCount: 0, credits: [], unavailableReason: 'surface', error: null });
  assert.equal(normalizeClaudeResetCredits({ eligible: false }, NOW).unavailableReason, 'unknown');
  assert.equal(normalizeClaudeResetCredits(null, NOW), null);
  assert.equal(normalizeClaudeResetCredits(undefined, NOW), null);
});

test('用量结果里带上重置卡；接口没有这个块时为 null', () => {
  assert.equal(normalizeClaudeOfficialUsage(LIVE_USAGE).resetCredits, null);
  const usage = normalizeClaudeOfficialUsage({ ...LIVE_USAGE, cedar_ember: { eligible: false, ineligible_reason: 'no_grant', grants: [] } });
  assert.equal(usage.resetCredits.unavailableReason, 'no_grant');
  assert.equal(usage.primaryWindow.usedPercent, 30);
});

test('invalid percentages cannot turn into a full remaining quota', () => {
  for (const value of [undefined, null, '', ' ', false, true, [], {}, 'oops', Infinity]) {
    assert.equal(normalizeClaudeOfficialUsage({ five_hour: { utilization: value } }), null);
  }
  const fallback = normalizeClaudeOfficialUsage({ five_hour: {}, limits: LIVE_USAGE.limits });
  assert.equal(fallback.primaryWindow.usedPercent, 30);
  assert.equal(normalizeClaudeOfficialUsage({ five_hour: { utilization: '0' } }).primaryWindow.remainingPercent, 100);
});
