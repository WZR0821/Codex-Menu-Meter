function nonNegativeFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function parseCodexRolloutLines(raw, state = {}) {
  const entries = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const isTokenCount = line.includes('"token_count"');
    const isTurnContext = line.includes('"turn_context"');
    const isSessionMeta = line.includes('"session_meta"');
    const isInterAgentBoundary = line.includes('"inter_agent_communication_metadata"');
    if (!isTokenCount && !isTurnContext && !isSessionMeta && !isInterAgentBoundary) continue;

    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    if (record?.type === 'session_meta') {
      // Subagent rollouts begin with a replay of their parent thread. Only the first
      // session_meta describes this file; later session_meta records belong to the replay.
      if (!state.hasSessionMeta) {
        state.hasSessionMeta = true;
        state.isSubagentSession = Boolean(record.payload?.source?.subagent);
        state.isReplayingParentHistory = state.isSubagentSession;
      }
      continue;
    }

    if (record?.type === 'inter_agent_communication_metadata') {
      if (state.isSubagentSession) state.isReplayingParentHistory = false;
      continue;
    }

    if (record?.type === 'turn_context') {
      const model = String(record.payload?.model || '').trim();
      if (model) state.model = model;
      continue;
    }

    if (record?.type !== 'event_msg' || record.payload?.type !== 'token_count') continue;
    if (state.isReplayingParentHistory) continue;

    const usage = record.payload?.info?.last_token_usage;
    if (!usage) continue;
    const ts = Date.parse(record.timestamp);
    if (Number.isNaN(ts)) continue;
    const input = nonNegativeFiniteNumber(usage.input_tokens);
    const cached = Math.min(nonNegativeFiniteNumber(usage.cached_input_tokens), input);
    const output = nonNegativeFiniteNumber(usage.output_tokens);
    const tokens = input + output;
    if (tokens <= 0) continue;
    entries.push({
      ts,
      tokens,
      inputTokens: input,
      cachedInputTokens: cached,
      // Codex 的 cached_input 是 input 的子集，读写口径要把缓存部分剔掉。
      ioTokens: (input - cached) + output,
      // 按 GPT-5.5/5.6 牌价比例加权（$5 输入 / $30 输出）：未缓存输入 1、缓存输入 0.1、输出 6。
      weighted: (input - cached) + cached * 0.1 + output * 6,
      model: state.model || null
    });
  }
  return entries;
}

module.exports = { parseCodexRolloutLines };
