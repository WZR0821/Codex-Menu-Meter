const test = require('node:test');
const assert = require('node:assert/strict');
const { RESULTS_URL, createCodexFourReader, normalizeCodexFourResults } = require('../src/codex-four-results');

// 两行取自 2026-11-20 的真实分榜（只留计算用到的字段），原站页面显示
// GPT-6.2 Sol low 119.19 / USD 0.36 / 411.9 秒，GPT-6.2 Astra max 137.18 / USD 8.52 / 4015.4 秒。
function fixture(overrides = {}) {
  return {
    schema: 'codex-four-task-results/1',
    protocol: 'codex-four-weighted-150-v2',
    round_id: 'codex-four-377-all-native-20261119',
    verified_at: '2026-11-20T01:09:52.642596+00:00',
    task_weights: { combined: 60, pompeii: 45, pelican: 22.5, candy: 22.5 },
    score_max: 150,
    all_graded: true,
    publication_status: 'complete',
    author_test_interval: {
      started_at: '2026-11-19T14:27:52.091213+00:00',
      completed_at: '2026-11-19T22:05:16.688182+00:00'
    },
    rows: [
      {
        model: 'gpt-6.2-sol', effort: 'low',
        pompeii: { model_elapsed_seconds: 135.01814648136497, cost_usd: 0.1489304, reward: 0.7619047619047619 },
        pelican: { model_elapsed_seconds: 127.73157258145511, cost_usd: 0.0907232, score: 96 },
        candy: { model_elapsed_seconds: 19.71811379864812, cost_usd: 0.030484, correct: true },
        combined: { model_elapsed_seconds: 129.43070808425546, cost_usd: 0.0903192, score: 68 }
      },
      {
        model: 'gpt-6.2-astra', effort: 'max',
        pompeii: { model_elapsed_seconds: 690.634073741734, cost_usd: 1.5266112, reward: 1.0 },
        pelican: { model_elapsed_seconds: 1394.0426578391343, cost_usd: 2.9728096, score: 99 },
        candy: { model_elapsed_seconds: 60.87351266294718, cost_usd: 0.195728, correct: true },
        combined: { model_elapsed_seconds: 1869.8522227667272, cost_usd: 3.8248704, score: 79 }
      }
    ],
    ...overrides
  };
}

test('computes the 150-point total, per-task cost and time like the source page', () => {
  const snapshot = normalizeCodexFourResults(fixture(), { readAt: Date.parse('2026-11-20T14:00:00Z') });
  assert.equal(snapshot.scoreMode, 'codex-four-weighted-150-v2');
  assert.equal(snapshot.roundTestedAt, '2026-11-19T14:27:52.091213+00:00');
  assert.equal(snapshot.timestampBasis, 'read');
  assert.equal(snapshot.updatedAt, '2026-11-20T14:00:00.000Z');
  assert.equal(snapshot.partial, false);
  assert.equal(snapshot.receivedCount, 2);

  const [sol, astra] = snapshot.items;
  assert.equal(sol.modelLabel, 'GPT-6.2 Sol');
  assert.equal(sol.reasoningEffort, 'low');
  assert.equal(sol.score.toFixed(2), '119.19');
  assert.equal(sol.totalCostUsd.toFixed(2), '0.36');
  assert.equal(sol.totalTaskSeconds.toFixed(1), '411.9');
  assert.equal(sol.averageCostUsd, sol.totalCostUsd / 4);
  assert.equal(sol.averageTaskTimeHuman, '1.7分钟');
  assert.deepEqual(sol.taskScores.map((task) => [task.key, Number(task.points.toFixed(2)), task.max]), [
    ['combined', 40.8, 60], ['pompeii', 34.29, 45], ['pelican', 21.6, 22.5], ['candy', 22.5, 22.5]
  ]);

  assert.equal(astra.modelLabel, 'GPT-6.2 Astra');
  assert.equal(astra.score.toFixed(2), '137.18');
  assert.equal(astra.totalCostUsd.toFixed(2), '8.52');
  assert.equal(astra.totalTaskSeconds.toFixed(1), '4015.4');
});

test('a row missing a task gets no total and marks the snapshot partial', () => {
  const raw = fixture();
  delete raw.rows[1].candy;
  const snapshot = normalizeCodexFourResults(raw);
  const astra = snapshot.items.find((item) => item.modelId === 'gpt-6.2-astra');
  assert.equal(astra.score, null);
  assert.equal(astra.coverage, 3);
  assert.equal(astra.averageCostUsd, null);
  assert.equal(snapshot.partial, true);
  assert.equal(snapshot.receivedCount, 1);
  assert.equal(snapshot.requestedCount, 2);
});

test('skips malformed and duplicate rows instead of failing the whole board', () => {
  const raw = fixture();
  raw.rows.push({ model: 'not a model', effort: 'max' }, { ...raw.rows[0] }, { model: 'gpt-6.2-sol', effort: 'turbo' });
  assert.equal(normalizeCodexFourResults(raw).items.length, 2);
});

test('format changes surface as radar-format-changed', () => {
  for (const raw of [
    fixture({ schema: 'something-else/1' }),
    fixture({ task_weights: { combined: 60, pompeii: 45, pelican: 22.5, newTask: 22.5 } }),
    fixture({ score_max: 100 }),
    fixture({ rows: 'nope' }),
    fixture({ rows: [] })
  ]) {
    assert.throws(() => normalizeCodexFourResults(raw), (error) => error.code === 'radar-format-changed');
  }
});

test('reader sends the last ETag and reuses the cached board on 304', async () => {
  const calls = [];
  const responses = [fixture(), null, null];
  const fetchJson = async (url, options) => {
    calls.push({ url, options });
    // 和原站一样：只有 200 带 ETag（Cloudflare 改成弱 ETag），304 回应不带。
    const etag = calls.length === 1 ? 'W/"abc"' : null;
    options.onResponse?.({ headers: { get: (name) => (name === 'etag' ? etag : null) } });
    return responses.shift();
  };
  const read = createCodexFourReader(fetchJson);
  const first = await read();
  const second = await read();
  const third = await read();
  assert.equal(calls[0].url, RESULTS_URL);
  assert.equal(calls[0].options.headers['If-None-Match'], undefined);
  assert.equal(calls[0].options.allowNotModified, false);
  assert.equal(calls[1].options.headers['If-None-Match'], 'W/"abc"');
  assert.equal(calls[1].options.allowNotModified, true);
  // 304 不带 ETag 时要保留上次的，第三次照样走 304。
  assert.equal(calls[2].options.headers['If-None-Match'], 'W/"abc"');
  assert.equal(second.items.length, first.items.length);
  assert.equal(second.items[0].score, first.items[0].score);
  assert.equal(third.items[0].score, first.items[0].score);
});
