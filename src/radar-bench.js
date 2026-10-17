const RADAR_ORIGIN = 'https://codexradar.com';
const BINDING_URL = `${RADAR_ORIGIN}/data/radar-bench-binding.json`;
const SCORE_VERSION = 'radar-bench-v2-150';

function number(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function modelName(model) {
  return model.replace(/^gpt/i, 'GPT').replace(/-(?=[a-z])/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function selectionKey(selection) {
  return `${selection.model}|${selection.effort}`;
}

// 与原站 observedMetric 一致：不把缺失费用当零，以有凭据的样本计算均值。
function observedMetric(metric, divisor = 1) {
  const count = number(metric?.known_samples);
  const missing = number(metric?.missing_samples);
  const total = number(metric?.known_total);
  return {
    mean: count > 0 && total !== null && total >= 0 ? total / count / divisor : null,
    known: count,
    total: count !== null && missing !== null ? count + missing : null,
    partial: missing > 0
  };
}

function normalizeSummary(raw, binding, selection, observedAt) {
  const score = number(raw?.score);
  if (raw?.model !== selection.model || raw?.effort !== selection.effort
    || raw?.score_version !== SCORE_VERSION || raw?.score_max !== 150
    || raw?.benchmark !== binding.benchmark || raw?.task_set_sha256 !== binding.task_set_sha256
    || raw?.catalog_version !== binding.catalog_version
    || raw?.required_tasks !== binding.total_tasks
    || (score !== null && (score < 0 || score > 150))) {
    throw new Error('RadarBench returned mismatched model, benchmark, or score scale');
  }
  const price = observedMetric(raw.statistics?.metrics?.api_equivalent_usd);
  const time = observedMetric(raw.statistics?.metrics?.elapsed_ms, 1000);
  const label = modelName(selection.model);
  return {
    label: `${label} ${selection.effort}`, modelLabel: label, modelId: selection.model,
    reasoningEffort: selection.effort, score, status: 'unknown',
    scoreBasis: SCORE_VERSION, scoreStatus: raw.score_status || 'unknown',
    coverage: number(raw.coverage), benchmarkTasks: number(raw.required_tasks),
    sampleCount: number(raw.graded_runs_count), sampleBasis: 'graded', sampleCount24h: null,
    averageCostUsd: price.mean, averageTaskSeconds: time.mean,
    averageTaskTimeHuman: time.mean === null ? null : `${(time.mean / 60).toFixed(1)}分钟`,
    costKnownSamples: price.known, costTotalSamples: price.total, costPartial: price.partial,
    durationKnownSamples: time.known, durationTotalSamples: time.total, durationPartial: time.partial,
    costBasis: 'official_standard_api_equivalent',
    // 原站只公开 UTC 日级历史，不能伪装成逐次判分或 24h 降智预警样本。
    recentScores: [], observedAt, readState: 'fresh',
    passed: null, tasks: null, catalogOnly: false
  };
}

function createRadarBenchReader(fetchJson) {
  let cooldownUntil = 0;
  return async function read({ previous = null, onProgress = () => {} } = {}) {
    if (Date.now() < cooldownUntil) throw new Error('RadarBench is cooling down after a temporary source limit');
    const binding = await fetchJson(BINDING_URL, { headers: { Referer: `${RADAR_ORIGIN}/` } });
    if (binding?.enabled !== true || binding?.production_read_verified !== true
      || !binding.benchmark || !binding.task_set_sha256 || !Array.isArray(binding.model_efforts)) {
      throw new Error('RadarBench public binding is unavailable');
    }
    const unique = new Map();
    for (const selection of binding.model_efforts) {
      if (/^gpt-\d+(?:\.\d+)*(?:-[a-z\d-]+)?$/.test(selection?.model)
        && /^(none|minimal|low|medium|high|xhigh|max|ultra)$/.test(selection?.effort)) {
        unique.set(selectionKey(selection), { model: selection.model, effort: selection.effort });
      }
    }
    const priority = ['gpt-6.1-sol|max', 'gpt-6-astra|max', 'gpt-6-luna|max', 'gpt-6.1-sol|medium'];
    const selections = [...unique.values()].sort((a, b) => {
      const rank = (selection) => { const index = priority.indexOf(selectionKey(selection)); return index < 0 ? priority.length : index; };
      return rank(a) - rank(b);
    }).slice(0, 96);
    if (!selections.length) throw new Error('RadarBench provides no bound Codex model selections');

    const priorItems = previous?.scoreMode === SCORE_VERSION && previous?.benchmark === binding.benchmark
      && previous?.taskSetHash === binding.task_set_sha256 ? previous.items || [] : [];
    const items = new Map(priorItems.filter((item) => !item.catalogOnly && unique.has(`${item.modelId}|${item.reasoningEffort}`))
      .map((item) => [`${item.modelId}|${item.reasoningEffort}`, { ...item, readState: 'cached' }]));
    let cursor = 0, completed = 0, received = 0, failures = 0, consecutiveFailures = 0, stopped = false;
    const deadline = Date.now() + 90_000;
    const snapshot = () => ({
      scoreMode: SCORE_VERSION, benchmark: binding.benchmark, taskSetHash: binding.task_set_sha256,
      catalogVersion: binding.catalog_version, timestampBasis: 'read',
      updatedAt: new Date().toISOString(), items: [...items.values()],
      requestedCount: selections.length, receivedCount: received,
      pendingCount: Math.max(0, selections.length - received), partial: received < selections.length
    });
    const worker = async () => {
      while (cursor < selections.length && !stopped && Date.now() < deadline) {
        const selection = selections[cursor++];
        try {
          const query = new URLSearchParams({ ...selection, view: 'summary' });
          const raw = await fetchJson(`${RADAR_ORIGIN}/api/radar-bench-score?${query}`, {
            headers: { Referer: `${RADAR_ORIGIN}/`, 'X-Radar-Bench-Selection': 'user-selected-v1' },
            requestTimeoutMs: 40_000
          });
          items.set(selectionKey(selection), normalizeSummary(raw, binding, selection, Date.now()));
          received += 1;
          consecutiveFailures = 0;
        } catch (error) {
          failures += 1;
          consecutiveFailures += 1;
          if ([401, 403, 429, 503].includes(error.status) || consecutiveFailures >= 3) {
            stopped = true;
            cooldownUntil = Date.now() + Math.max(5 * 60_000, error.retryAfterMs || 0);
          }
        }
        completed += 1;
        if (received > 0 && (completed % 4 === 0 || completed === selections.length)) onProgress(snapshot());
      }
    };
    // 原站的有界队列最多并发 3 个；这里使用 2 个，不在失败后循环轰炸。
    await Promise.all([worker(), worker()]);
    if (!received) throw new Error('RadarBench current scores could not be read; retaining the last valid snapshot');
    return { ...snapshot(), failedCount: failures };
  };
}

module.exports = { createRadarBenchReader };
