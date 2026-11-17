const test = require('node:test');
const assert = require('node:assert/strict');
const { parseClaudeTranscriptLines } = require('../src/claude-token-activity');

function jsonl(...records) {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

function assistant({
  input = 0,
  output = 0,
  cacheCreation = 0,
  cacheRead = 0,
  id = 'msg_1',
  requestId = 'req_1',
  uuid = 'uuid-1',
  sessionId = 'session-1',
  model = 'claude-opus-5',
  timestamp = '2026-08-02T03:28:14.936Z'
} = {}) {
  return {
    type: 'assistant',
    timestamp,
    uuid,
    requestId,
    sessionId,
    message: {
      id,
      model,
      usage: {
        input_tokens: input,
        output_tokens: output,
        cache_creation_input_tokens: cacheCreation,
        cache_read_input_tokens: cacheRead
      }
    }
  };
}

test('counts cache creation as non-cached input, matching the Codex I/O definition', () => {
  const [entry] = parseClaudeTranscriptLines(jsonl(assistant({
    input: 1_000,
    cacheCreation: 20_000,
    cacheRead: 500_000,
    output: 2_000
  })));

  // 总量含缓存读取；读写只算非缓存输入 + 输出，和 Codex 的 (input - cached) + output 同口径。
  assert.equal(entry.tokens, 523_000);
  assert.equal(entry.inputTokens, 521_000);
  assert.equal(entry.cachedInputTokens, 500_000);
  assert.equal(entry.ioTokens, 23_000);
  assert.equal(entry.model, 'claude-opus-5');
  assert.equal(entry.sessionId, 'session-1');
});

test('cache creation is never silently dropped from the I/O total', () => {
  const [withCacheWrite] = parseClaudeTranscriptLines(jsonl(assistant({ input: 10, cacheCreation: 90_000, output: 100 })));
  const [withoutCacheWrite] = parseClaudeTranscriptLines(jsonl(assistant({ input: 10, output: 100 })));
  assert.equal(withCacheWrite.ioTokens - withoutCacheWrite.ioTokens, 90_000);
});

test('cache hit rate uses every input token as the denominator', () => {
  const [entry] = parseClaudeTranscriptLines(jsonl(assistant({
    input: 100,
    cacheCreation: 900,
    cacheRead: 99_000,
    output: 50
  })));
  assert.equal(entry.cachedInputTokens / entry.inputTokens, 99_000 / 100_000);
});

test('weights tokens by the published price ratios', () => {
  const [entry] = parseClaudeTranscriptLines(jsonl(assistant({
    input: 1_000,
    output: 1_000,
    cacheCreation: 1_000,
    cacheRead: 1_000
  })));
  assert.equal(entry.weighted, 1_000 + 5_000 + 1_250 + 100);
});

test('keys entries so replayed parent history can be de-duplicated', () => {
  const entries = parseClaudeTranscriptLines(jsonl(
    assistant({ input: 1, output: 1, id: 'msg_a', requestId: 'req_a', uuid: 'uuid-original' }),
    // 续接会话把同一次调用重放进新文件：uuid 变了，message.id + requestId 不变。
    assistant({ input: 1, output: 1, id: 'msg_a', requestId: 'req_a', uuid: 'uuid-replayed' }),
    assistant({ input: 1, output: 1, id: 'msg_b', requestId: 'req_b', uuid: 'uuid-other' })
  ));
  assert.deepEqual(entries.map((entry) => entry.id), ['msg_a:req_a', 'msg_a:req_a', 'msg_b:req_b']);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 2);
});

test('falls back to the record uuid when the request id is missing', () => {
  const [entry] = parseClaudeTranscriptLines(jsonl(
    assistant({ input: 1, output: 1, requestId: null, uuid: 'uuid-only' })
  ));
  assert.equal(entry.id, 'uuid-only');
});

test('skips records without usage, without a timestamp, or with no tokens', () => {
  assert.deepEqual(parseClaudeTranscriptLines(jsonl(
    { type: 'user', timestamp: '2026-08-02T03:28:14.936Z', message: { content: 'hi' } },
    { type: 'assistant', timestamp: 'not-a-date', message: { id: 'x', usage: { input_tokens: 5 } } },
    assistant({ input: 0, output: 0 }),
    assistant({ input: -10, output: -10 })
  )), []);
});

test('splits cache writes into 5-minute and 1-hour tiers and keeps cwd', () => {
  const line = JSON.stringify({
    type: 'assistant',
    timestamp: '2026-11-13T03:00:00.000Z',
    requestId: 'req_tier',
    sessionId: 'session-tier',
    cwd: '/Users/me/Documents/project',
    message: {
      id: 'msg_tier',
      model: 'claude-fable-5-2',
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: 1_000,
        cache_read_input_tokens: 5_000,
        cache_creation: { ephemeral_5m_input_tokens: 400, ephemeral_1h_input_tokens: 600 },
        speed: 'standard'
      }
    }
  });
  const [entry] = parseClaudeTranscriptLines(line);
  assert.equal(entry.baseInputTokens, 10);
  assert.equal(entry.cacheWrite5mTokens, 400);
  assert.equal(entry.cacheWrite1hTokens, 600);
  assert.equal(entry.outputTokens, 20);
  assert.equal(entry.speed, 'standard');
  assert.equal(entry.cwd, '/Users/me/Documents/project');
});
