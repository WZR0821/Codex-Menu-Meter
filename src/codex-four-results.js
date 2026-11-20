// Codex 雷达站「四题众测」正式分榜：https://codexradar.com/data/codex-four-task-results.json
// 2026-11 起原站旧的 RadarBench 打分接口（/api/radar-bench-score）长期返回 502，
// 首页也改成展示这份分榜；本模块只读这一份公开 JSON，不带任何登录凭据。
const RESULTS_URL = 'https://codexradar.com/data/codex-four-task-results.json';
const RADAR_HOME = 'https://codexradar.com/';
const SCHEMA_PREFIX = 'codex-four-task-results/';
const TASKS = ['combined', 'pompeii', 'pelican', 'candy'];
const MODEL_PATTERN = /^gpt-\d+(?:\.\d+)*(?:-[a-z\d-]+)?$/;
const EFFORT_PATTERN = /^(none|minimal|low|medium|high|xhigh|max|ultra)$/;
const MAX_ROWS = 200;

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function modelName(model) {
  return model.replace(/^gpt/i, 'GPT').replace(/-(?=[a-z])/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function formatChangedError(detail) {
  const error = new Error(`Codex radar four-task results changed format: ${detail}`);
  error.code = 'radar-format-changed';
  return error;
}

// 每题原始分折成 0–1，口径与原站 iq-live-results-contract 的 MAX_RAW 一致：
// 秦始皇、鹈鹕是 0–100 分，庞贝是 0–1 的 reward，糖果只有对错。
function taskFraction(kind, task) {
  if (!task || typeof task !== 'object') return null;
  let value = null;
  if (kind === 'combined' || kind === 'pelican') {
    const score = finite(task.score);
    value = score === null ? null : score / 100;
  } else if (kind === 'pompeii') {
    value = finite(task.reward);
  } else if (kind === 'candy') {
    value = typeof task.correct === 'boolean' ? Number(task.correct) : null;
  }
  return value !== null && value >= 0 && value <= 1 ? value : null;
}

function readWeights(raw) {
  const weights = raw?.task_weights;
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) throw formatChangedError('task_weights');
  const names = Object.keys(weights);
  if (names.length !== TASKS.length || !TASKS.every((name) => finite(weights[name]) > 0)) {
    throw formatChangedError('task set');
  }
  const scoreMax = finite(raw.score_max);
  const sum = TASKS.reduce((total, name) => total + weights[name], 0);
  if (scoreMax === null || Math.abs(sum - scoreMax) > 1e-6) throw formatChangedError('score_max');
  return { weights, scoreMax };
}

function normalizeRow(row, weights, observedAt) {
  const model = row?.model;
  const effort = row?.effort;
  if (typeof model !== 'string' || !MODEL_PATTERN.test(model) || typeof effort !== 'string' || !EFFORT_PATTERN.test(effort)) {
    return null;
  }
  let costTotal = 0, costKnown = 0, secondsTotal = 0, secondsKnown = 0;
  const taskScores = TASKS.map((key) => {
    const task = row[key];
    const fraction = taskFraction(key, task);
    const cost = finite(task?.cost_usd);
    const seconds = finite(task?.model_elapsed_seconds);
    if (cost !== null && cost >= 0) { costTotal += cost; costKnown += 1; }
    if (seconds !== null && seconds >= 0) { secondsTotal += seconds; secondsKnown += 1; }
    return { key, points: fraction === null ? null : weights[key] * fraction, max: weights[key] };
  });
  const graded = taskScores.filter((task) => task.points !== null).length;
  // 与原站一致：四题齐了才计总分，缺项不补 0。
  const score = graded === TASKS.length ? taskScores.reduce((total, task) => total + task.points, 0) : null;
  const costComplete = costKnown === TASKS.length;
  const timeComplete = secondsKnown === TASKS.length;
  const label = modelName(model);
  return {
    label: `${label} ${effort}`, modelLabel: label, modelId: model, reasoningEffort: effort,
    score, status: 'unknown',
    taskScores,
    coverage: graded, benchmarkTasks: TASKS.length,
    sampleCount: graded, sampleBasis: 'graded', sampleCount24h: null,
    // 「平均」按每题算，和原站权衡图的「每题费用 / 每题耗时」一致；四题合计另存一份给详情说明。
    averageCostUsd: costComplete ? costTotal / TASKS.length : null,
    averageTaskSeconds: timeComplete ? secondsTotal / TASKS.length : null,
    // 与旧 RadarBench 同样写成「x.x分钟」，界面会按语言换成对应的分钟单位。
    averageTaskTimeHuman: timeComplete ? `${(secondsTotal / TASKS.length / 60).toFixed(1)}分钟` : null,
    totalCostUsd: costComplete ? costTotal : null,
    totalTaskSeconds: timeComplete ? secondsTotal : null,
    costKnownSamples: costKnown, costTotalSamples: TASKS.length, costPartial: !costComplete,
    costBasis: 'four_task_api_equivalent',
    recentScores: [], observedAt, readState: 'fresh',
    passed: null, tasks: null, catalogOnly: false
  };
}

function normalizeCodexFourResults(raw, { readAt = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object' || typeof raw.schema !== 'string' || !raw.schema.startsWith(SCHEMA_PREFIX)) {
    throw formatChangedError('schema');
  }
  if (!Array.isArray(raw.rows)) throw formatChangedError('rows');
  const { weights, scoreMax } = readWeights(raw);
  const seen = new Set();
  const items = [];
  for (const row of raw.rows.slice(0, MAX_ROWS)) {
    const item = normalizeRow(row, weights, readAt);
    if (!item) continue;
    const key = `${item.modelId}|${item.reasoningEffort}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  const scored = items.filter((item) => item.score !== null).length;
  if (!scored) throw formatChangedError('no scored rows');
  // 批次名里的日期是开测那天（如 20261119），所以取开测时间来标注批次。
  const roundTestedAt = raw.author_test_interval?.started_at || raw.verified_at || raw.score_snapshot_at || null;
  return {
    scoreMode: typeof raw.protocol === 'string' && raw.protocol.startsWith('codex-four-') ? raw.protocol : 'codex-four',
    scoreMax,
    roundId: typeof raw.round_id === 'string' ? raw.round_id : null,
    roundTestedAt: typeof roundTestedAt === 'string' && Number.isFinite(Date.parse(roundTestedAt)) ? roundTestedAt : null,
    publicationStatus: typeof raw.publication_status === 'string' ? raw.publication_status : null,
    timestampBasis: 'read',
    updatedAt: new Date(readAt).toISOString(),
    items,
    requestedCount: items.length,
    receivedCount: scored,
    pendingCount: items.length - scored,
    partial: scored < items.length || raw.all_graded === false
  };
}

// 分榜一轮只发布一次，文件约 200 KB；带上 ETag，没变化时服务器只回 304。
function createCodexFourReader(fetchJson) {
  let etag = null;
  let lastRaw = null;
  return async function read() {
    let responseEtag = null;
    const raw = await fetchJson(RESULTS_URL, {
      headers: { Referer: RADAR_HOME, ...(etag && lastRaw ? { 'If-None-Match': etag } : {}) },
      allowNotModified: Boolean(etag && lastRaw),
      onResponse: (response) => { responseEtag = response.headers.get('etag'); }
    });
    const source = raw === null ? lastRaw : raw;
    const snapshot = normalizeCodexFourResults(source);
    if (raw !== null) {
      lastRaw = raw;
      etag = responseEtag || null;
    }
    return snapshot;
  };
}

module.exports = { RESULTS_URL, createCodexFourReader, normalizeCodexFourResults };
