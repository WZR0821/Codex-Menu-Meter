const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const {
  normalizeAntigravityUsage,
  normalizeHub,
  findLanguageServer,
  readAntigravityUsage,
  parseGeneration,
  entriesFromRows,
  workspacePath
} = require('../src/antigravity');
const pace = require('../src/mobile/usage-pace');
const { formatModelName } = require('../src/mobile/token-week');

// 2026-11-27 本机 Antigravity 2.35.2（免费档）RetrieveUserQuotaSummary 的原样结构（描述文字略去）。
const FREE_SUMMARY = {
  response: {
    groups: [
      {
        displayName: 'Gemini Models',
        description: 'Models within this group: Gemini 4 Hydrogen, Gemini 3.8 Flash',
        buckets: [
          { bucketId: 'gemini-weekly', displayName: 'Weekly Limit Remaining', window: 'weekly', remainingFraction: 0.703012, resetTime: '2026-12-04T14:42:12Z' }
        ]
      },
      {
        displayName: 'Claude and GPT models',
        description: 'Models within this group: Claude Sonnet 4.6, Claude Opus 4.6, GPT-OSS 120B',
        buckets: [
          { bucketId: '3p-weekly', displayName: 'Weekly Limit Remaining', window: 'weekly', remainingFraction: 1 },
          { bucketId: '3p-5h', displayName: 'Five Hour Limit Remaining', window: '5h', remainingFraction: 1 }
        ]
      }
    ]
  }
};

const STATUS = { userStatus: { name: 'x', email: 'x@example.com', userTier: { id: 'free-tier', name: 'Antigravity Starter Quota' } } };

test('free tier: Gemini weekly is the big number, Claude/GPT 5h fills the 5h card, Claude/GPT weekly folds into the weekly card', () => {
  const usage = normalizeAntigravityUsage(FREE_SUMMARY, STATUS);
  assert.equal(usage.planType, 'Starter');
  assert.deepEqual(usage.secondaryWindow, { usedPercent: 30, remainingPercent: 70, resetAt: Date.parse('2026-12-04T14:42:12Z'), group: 'Gemini' });
  assert.deepEqual(usage.primaryWindow, { usedPercent: 0, remainingPercent: 100, resetAt: null, inactive: true, group: 'Claude/GPT' });
  assert.equal(usage.extraWindows.length, 1);
  assert.equal(usage.extraWindows[0].name, 'Claude/GPT');
  assert.equal(usage.extraWindows[0].fold, 'week');
  assert.equal(usage.limitReached, false);
  // 不把姓名、邮箱带进状态。
  assert.ok(!JSON.stringify(usage).includes('example.com'));
});

test('paid tier: both groups have 5h windows, the other group folds into each card', () => {
  const summary = JSON.parse(JSON.stringify(FREE_SUMMARY));
  summary.response.groups[0].buckets.push({ bucketId: 'gemini-5h', window: '5h', remainingFraction: 0.4, resetTime: '2026-11-28T03:00:00Z' });
  summary.response.groups[1].buckets[1] = { bucketId: '3p-5h', window: '5h', resetTime: '2026-11-28T04:00:00Z' };
  const usage = normalizeAntigravityUsage(summary, null);
  assert.equal(usage.planType, null);
  assert.equal(usage.primaryWindow.group, 'Gemini');
  assert.equal(usage.primaryWindow.remainingPercent, 40);
  const five = usage.extraWindows.find((item) => item.fold === 'five');
  // proto3 JSON 省掉了 0：有重置时间、没剩余比例 = 用尽。
  assert.equal(five.remainingPercent, 0);
  assert.equal(five.name, 'Claude/GPT · 5h');
  assert.equal(five.label, 'Claude/GPT');
  assert.equal(usage.limitReached, true);
  assert.equal(pace.windowDurationMs(`extra:${five.name}`, 'antigravity'), pace.FIVE_HOUR_MS);
  assert.equal(pace.windowDurationMs('extra:Claude/GPT', 'antigravity'), pace.WEEK_MS);
  const keys = pace.listWindows(usage, { provider: 'antigravity' }).map((entry) => entry.key);
  // 还没开始的 Claude/GPT 一周窗口（剩 100%、没有重置时间）不参与节奏和提醒。
  assert.deepEqual(keys, ['five', 'week', 'extra:Claude/GPT · 5h']);
});

test('quota summary without groups is rejected', () => {
  assert.equal(normalizeAntigravityUsage({ response: {} }, STATUS), null);
  assert.equal(normalizeAntigravityUsage(null, null), null);
});

test('hub file: needs a port and a token; stale pids are skipped', async () => {
  assert.equal(normalizeHub({ httpPort: 1, csrfToken: '' }), null);
  assert.equal(normalizeHub({ csrfToken: 'x' }), null);
  assert.deepEqual(normalizeHub({ pid: 5, httpsPort: 59969, httpPort: 59970, csrfToken: ' t ', lsVersion: '2.35.2' }), {
    pid: 5, httpPort: 59970, httpsPort: 59969, csrfToken: 't', version: '2.35.2'
  });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cmm-ag-'));
  try {
    await fs.mkdir(path.join(root, 'daemon'));
    await fs.writeFile(path.join(root, 'daemon', 'hub_1.json'), JSON.stringify({ pid: 111, httpPort: 1, csrfToken: 'dead' }));
    await fs.writeFile(path.join(root, 'daemon', 'hub_2.json'), JSON.stringify({ pid: 222, httpPort: 2, csrfToken: 'live' }));
    const hub = await findLanguageServer({ root, isAlive: (pid) => pid === 222 });
    assert.equal(hub.csrfToken, 'live');
    assert.equal(await findLanguageServer({ root, isAlive: () => false }), null);
    await assert.rejects(readAntigravityUsage({ root, isAlive: () => false }), { code: 'antigravity-not-running' });
    const usage = await readAntigravityUsage({
      root,
      isAlive: () => true,
      call: async (_hub, method) => (method === 'RetrieveUserQuotaSummary' ? FREE_SUMMARY : STATUS)
    });
    assert.equal(usage.secondaryWindow.remainingPercent, 70);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---- protobuf ----

function varint(value) {
  const bytes = [];
  let rest = value;
  while (rest >= 0x80) {
    bytes.push((rest % 128) | 0x80);
    rest = Math.floor(rest / 128);
  }
  bytes.push(rest);
  return Buffer.from(bytes);
}
const vField = (field, value) => Buffer.concat([varint(field * 8), varint(value)]);
const lField = (field, payload) => {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  return Buffer.concat([varint(field * 8 + 2), varint(body.length), body]);
};
const msg = (...parts) => Buffer.concat(parts);

function generation({ input, output, cacheRead = 0, cacheWrite = 0, thinking = 0, response = 0, model = 'gemini-4-hydrogen', step = 3, responseId = 'r1' }) {
  const usage = msg(vField(1, 1525), vField(2, input), vField(3, output), cacheWrite ? vField(4, cacheWrite) : Buffer.alloc(0), vField(5, cacheRead),
    vField(9, thinking), vField(10, response), lField(11, responseId), vField(6, 24));
  const custom = lField(20, msg(lField(1, 'last_step_index'), lField(2, String(step))));
  const chat = msg(vField(3, 1525), lField(4, usage), lField(19, model), custom, lField(21, 'Gemini 4 Hydrogen (High)'),
    // 未知的 64 位字段（fixed64）要能跳过
    Buffer.concat([varint(13 * 8 + 1), Buffer.alloc(8)]));
  return msg(lField(1, chat), lField(2, varint(step)), lField(4, 'exec-1'));
}

function stepMetadata(seconds) {
  return msg(lField(1, msg(vField(1, seconds), vField(2, 5_000_000))), vField(3, 5));
}

test('generation metadata: usage, model and step index come out of the protobuf', () => {
  const parsed = parseGeneration(generation({ input: 4905, output: 1124, cacheRead: 24570, thinking: 686, response: 438 }));
  assert.equal(parsed.input, 4905);
  assert.equal(parsed.output, 1124);
  assert.equal(parsed.cacheRead, 24570);
  assert.equal(parsed.cacheWrite, 0);
  assert.equal(parsed.model, 'gemini-4-hydrogen');
  assert.deepEqual(parsed.stepIndices, [3]);
  assert.equal(parsed.lastStepIndex, 3);
  assert.equal(parsed.responseId, 'r1');
  assert.equal(parseGeneration(Buffer.from([0xff, 0xff])), null);
});

test('entries: Claude-style token fields, step timestamps, dedupe key', () => {
  const rows = [
    { idx: 0, data: generation({ input: 100, output: 20, cacheRead: 900, step: 1, responseId: 'a' }) },
    { idx: 1, data: generation({ input: 50, output: 0, thinking: 7, response: 3, cacheRead: 0, step: 9, responseId: 'b' }) },
    { idx: 2, data: msg(lField(1, msg(vField(3, 1)))) }
  ];
  const steps = [{ idx: 1, metadata: stepMetadata(1795790572) }];
  const entries = entriesFromRows(rows, steps, { sessionId: 'conv', cwd: '/tmp/p', fallbackTs: 1 });
  assert.equal(entries.length, 2);
  const [first, second] = entries;
  assert.equal(first.id, 'ag:a');
  assert.equal(first.ts, 1795790572005);
  assert.equal(first.tokens, 1020);
  assert.equal(first.inputTokens, 1000);
  assert.equal(first.cachedInputTokens, 900);
  assert.equal(first.ioTokens, 120);
  assert.equal(first.baseInputTokens, 100);
  assert.equal(first.outputTokens, 20);
  assert.equal(first.sessionId, 'conv');
  assert.equal(first.cwd, '/tmp/p');
  // 第 9 步不在 steps 表里：沿用上一条的时间。
  assert.equal(second.ts, first.ts);
  // 只有分项时按思考 + 回答相加。
  assert.equal(second.outputTokens, 10);
});

test('workspace uris become a local path', () => {
  assert.equal(workspacePath('file:///Users/me/My%20Project'), '/Users/me/My Project');
  assert.equal(workspacePath(''), null);
  assert.equal(workspacePath('https://example.com'), null);
});

test('Gemini model ids get a readable name', () => {
  assert.equal(formatModelName('gemini-4-hydrogen'), 'Gemini 4 Hydrogen');
  assert.equal(formatModelName('gemini-3.8-flash'), 'Gemini 3.8 Flash');
  assert.equal(formatModelName('claude-opus-5-5'), 'Opus 5.5');
});
