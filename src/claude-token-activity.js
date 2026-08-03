function nonNegativeFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function parseClaudeTranscriptLines(raw) {
  const entries = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record?.type !== 'assistant') continue;
    const message = record.message;
    const usage = message?.usage;
    if (!usage) continue;
    const ts = Date.parse(record.timestamp);
    if (Number.isNaN(ts)) continue;

    const inputTokens = nonNegativeFiniteNumber(usage.input_tokens);
    const outputTokens = nonNegativeFiniteNumber(usage.output_tokens);
    const cacheCreationTokens = nonNegativeFiniteNumber(usage.cache_creation_input_tokens);
    const cachedInputTokens = nonNegativeFiniteNumber(usage.cache_read_input_tokens);
    const totalInputTokens = inputTokens + cacheCreationTokens + cachedInputTokens;
    const tokens = totalInputTokens + outputTokens;
    if (tokens <= 0) continue;

    entries.push({
      // 会话续接和分叉会把父对话整段重放进新文件，同一次 API 调用因此会出现多份。
      // message.id + requestId 在重放里保持不变，是唯一可靠的去重键。
      id: message.id && record.requestId ? `${message.id}:${record.requestId}` : record.uuid || null,
      ts,
      tokens,
      inputTokens: totalInputTokens,
      cachedInputTokens,
      // 按 API 计费比例加权，让缓存读取不至于淹没真实用量。
      // Claude 牌价比例：输出 5×、缓存写 1.25×、缓存读 0.1×。
      weighted: inputTokens + outputTokens * 5 + cacheCreationTokens * 1.25 + cachedInputTokens * 0.1,
      // 读写口径要和 Codex 的 (input - cached) + output 对齐：非缓存输入 + 输出。
      // Claude 的非缓存输入是 input + cache_creation，只有 cache_read 才是命中缓存的部分。
      // 漏掉 cache_creation 会把「读写」少算十几倍——它恰恰是模型第一次真正处理的新增内容。
      ioTokens: inputTokens + cacheCreationTokens + outputTokens,
      model: String(message.model || '').trim() || null,
      sessionId: record.sessionId || null
    });
  }
  return entries;
}

module.exports = { parseClaudeTranscriptLines };
