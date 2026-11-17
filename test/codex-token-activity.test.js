const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCodexRolloutLines } = require('../src/codex-token-activity');

function jsonl(...records) {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

function sessionMeta(source = 'vscode', sessionId = 'thread-main') {
  return {
    timestamp: '2026-07-18T03:28:07.890Z',
    type: 'session_meta',
    payload: { source, session_id: sessionId, id: 'rollout-file-id' }
  };
}

function turnContext(model) {
  return {
    timestamp: '2026-07-18T03:28:09.382Z',
    type: 'turn_context',
    payload: { model }
  };
}

function tokenCount({ input, cached, output, timestamp = '2026-07-18T03:28:14.936Z' }) {
  return {
    timestamp,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: {
          input_tokens: input,
          cached_input_tokens: cached,
          output_tokens: output
        }
      }
    }
  };
}

test('parses token counts from a primary Codex session', () => {
  const entries = parseCodexRolloutLines(jsonl(
    sessionMeta(),
    turnContext('gpt-5.6-sol'),
    tokenCount({ input: 1_000, cached: 800, output: 100 })
  ));

  assert.deepEqual(entries, [{
    ts: Date.parse('2026-07-18T03:28:14.936Z'),
    tokens: 1_100,
    inputTokens: 1_000,
    cachedInputTokens: 800,
    ioTokens: 300,
    weighted: 880,
    baseInputTokens: 200,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    outputTokens: 100,
    model: 'gpt-5.6-sol',
    sessionId: 'thread-main',
    cwd: null
  }]);
});

test('attributes a subagent rollout to the thread that spawned it', () => {
  const entries = parseCodexRolloutLines(jsonl(
    {
      timestamp: '2026-07-18T03:28:07.890Z',
      type: 'session_meta',
      payload: {
        session_id: 'thread-parent',
        id: 'rollout-child-file',
        parent_thread_id: 'thread-parent',
        source: { subagent: { thread_spawn: { parent_thread_id: 'thread-parent' } } }
      }
    },
    { timestamp: '2026-07-18T03:28:09.422Z', type: 'inter_agent_communication_metadata' },
    turnContext('gpt-child'),
    tokenCount({ input: 2_000, cached: 1_000, output: 200 })
  ));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sessionId, 'thread-parent');
});

test('excludes imported parent history from a subagent rollout', () => {
  const entries = parseCodexRolloutLines(jsonl(
    sessionMeta({ subagent: { thread_spawn: { parent_thread_id: 'parent' } } }),
    sessionMeta('vscode'),
    turnContext('gpt-parent'),
    tokenCount({ input: 200_000, cached: 190_000, output: 2_000 }),
    turnContext('gpt-child'),
    { timestamp: '2026-07-18T03:28:09.422Z', type: 'inter_agent_communication_metadata' },
    tokenCount({ input: 2_000, cached: 1_000, output: 200 })
  ));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].tokens, 2_200);
  assert.equal(entries[0].inputTokens, 2_000);
  assert.equal(entries[0].cachedInputTokens, 1_000);
  assert.equal(entries[0].ioTokens, 1_200);
  assert.equal(entries[0].model, 'gpt-child');
});

test('keeps replay state across incrementally appended chunks', () => {
  const state = {};
  const imported = parseCodexRolloutLines(jsonl(
    sessionMeta({ subagent: { thread_spawn: { parent_thread_id: 'parent' } } }),
    tokenCount({ input: 90_000, cached: 80_000, output: 1_000 })
  ), state);

  assert.deepEqual(imported, []);
  assert.equal(state.isReplayingParentHistory, true);

  const live = parseCodexRolloutLines(jsonl(
    { timestamp: '2026-07-18T03:28:09.422Z', type: 'inter_agent_communication_metadata' },
    turnContext('gpt-child'),
    tokenCount({ input: 3_000, cached: 2_000, output: 300 })
  ), state);

  assert.equal(live.length, 1);
  assert.equal(live[0].tokens, 3_300);
  assert.equal(state.isReplayingParentHistory, false);
});

test('ignores non-finite or negative token fields', () => {
  const entries = parseCodexRolloutLines(jsonl(
    sessionMeta(),
    tokenCount({ input: '1e309', cached: -50, output: -1 })
  ));

  assert.deepEqual(entries, []);
});

test('counts a repeated cumulative usage snapshot only once across chunks', () => {
  const state = {};
  const first = tokenCount({ input: 1000, cached: 500, output: 100 });
  first.payload.info.total_token_usage = { input_tokens: 1000, cached_input_tokens: 500, output_tokens: 100, total_tokens: 1100 };
  const repeat = structuredClone(first);
  repeat.timestamp = '2026-07-18T03:29:14.936Z';
  assert.equal(parseCodexRolloutLines(jsonl(first), state).length, 1);
  assert.equal(parseCodexRolloutLines(jsonl(repeat), state).length, 0);
  const next = structuredClone(repeat);
  next.payload.info.total_token_usage = { input_tokens: 2000, cached_input_tokens: 1000, output_tokens: 200, total_tokens: 2200 };
  assert.equal(parseCodexRolloutLines(jsonl(next), state).length, 1);
  // An actual context reset may lower cumulative totals; the next call still counts.
  assert.equal(parseCodexRolloutLines(jsonl(first), state).length, 1);
});

test('identical request sizes without cumulative totals remain distinct calls', () => {
  const record = tokenCount({ input: 1000, cached: 500, output: 100 });
  assert.equal(parseCodexRolloutLines(jsonl(record, record)).length, 2);
});
