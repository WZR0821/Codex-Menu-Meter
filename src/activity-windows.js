const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function currentWindowStart(resetAt, durationMs, now = Date.now()) {
  let reset = Number(resetAt);
  if (Number.isFinite(reset) && reset > 0) {
    if (reset <= now) {
      reset += (Math.floor((now - reset) / durationMs) + 1) * durationMs;
    }
    if (reset > now && reset - now <= durationMs) {
      return { startAt: reset - durationMs, endAt: now, basis: 'cycle' };
    }
  }
  return { startAt: now - durationMs, endAt: now, basis: 'rolling' };
}

function summarizeWindow(entries, windowValue) {
  const totals = {
    ...windowValue,
    tokens: 0,
    ioTokens: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    threads: 0
  };
  const sessions = new Set();
  for (const entry of entries || []) {
    const timestamp = Number(entry?.ts);
    if (!Number.isFinite(timestamp) || timestamp < totals.startAt || timestamp > totals.endAt) continue;
    totals.tokens += Math.max(0, Number(entry.tokens) || 0);
    totals.ioTokens += Math.max(0, Number(entry.ioTokens) || 0);
    totals.inputTokens += Math.max(0, Number(entry.inputTokens) || 0);
    totals.cachedInputTokens += Math.max(0, Number(entry.cachedInputTokens) || 0);
    if (entry.sessionId) sessions.add(entry.sessionId);
  }
  totals.threads = sessions.size;
  return totals;
}

function buildActivityWindows(entries, usage, now = Date.now()) {
  return {
    fiveHour: summarizeWindow(entries, currentWindowStart(usage?.primaryWindow?.resetAt, FIVE_HOURS_MS, now)),
    week: summarizeWindow(entries, currentWindowStart(usage?.secondaryWindow?.resetAt, SEVEN_DAYS_MS, now))
  };
}

module.exports = {
  FIVE_HOURS_MS,
  SEVEN_DAYS_MS,
  buildActivityWindows,
  currentWindowStart,
  summarizeWindow
};
