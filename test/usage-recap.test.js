const test = require('node:test');
const assert = require('node:assert/strict');
const recap = require('../src/usage-recap.js');

const HOUR = 3_600_000;
const at = (month, date, hour = 0, minute = 0) => new Date(2026, month - 1, date, hour, minute).getTime();

test('the report covers the last complete Monday–Sunday week, even on a Sunday', () => {
  const monday = recap.lastCompleteWeek(at(11, 23, 15, 30));
  assert.equal(monday.startAt, at(11, 16));
  assert.equal(monday.endAt, at(11, 23));
  assert.equal(monday.previousStartAt, at(11, 9));
  const sunday = recap.lastCompleteWeek(at(11, 29, 23, 59));
  assert.equal(sunday.startAt, at(11, 16), 'this week is not over yet on Sunday');
  const nextMonday = recap.lastCompleteWeek(at(11, 30, 0, 1));
  assert.equal(nextMonday.startAt, at(11, 23));
});

test('weekly report sums the week, finds the busiest day and hour, and ranks models and projects', () => {
  const entry = (ts, tokens, extra = {}) => ({ ts, tokens, ioTokens: tokens / 10, inputTokens: tokens, cachedInputTokens: tokens * 0.9, model: 'claude-opus-5-5', sessionId: 's1', cwd: '/w/alpha', ...extra });
  const entries = [
    entry(at(11, 16, 9), 100),
    entry(at(11, 18, 14), 500, { sessionId: 's2', cwd: '/w/beta' }),
    entry(at(11, 18, 14, 30), 300, { model: 'claude-fable-5-2', sessionId: 's2', cwd: '/w/beta/src' }),
    entry(at(11, 20, 21), 50, { model: 'claude-sonnet-5-5', sessionId: 's3', cwd: '/w/gamma' }),
    entry(at(11, 21, 8), 20, { model: 'gpt-x', sessionId: 's4', cwd: '/w/delta' }),
    entry(at(11, 22, 23, 59), 30, { model: 'claude-haiku-5-5', sessionId: 's5', cwd: '/w/epsilon' }),
    // 前一周和本周的不算进来，前一周只用来比较
    entry(at(11, 12, 10), 400),
    entry(at(11, 23, 1), 9999)
  ];
  const costOf = (item) => (item.model === 'gpt-x' ? null : item.tokens / 100);
  const createProjectResolver = () => (cwd) => {
    const root = cwd.startsWith('/w/beta') ? '/w/beta' : cwd;
    return { key: root, name: root.split('/').pop() };
  };
  const samples = [
    { t: at(11, 15, 12), week: 99 },
    { t: at(11, 17, 12), week: 40 },
    { t: at(11, 20, 21, 10), week: 88 },
    { t: at(11, 21, 9), week: 5 },
    { t: at(11, 22, 9), week: null }
  ];
  const report = recap.buildWeeklyReport(entries, { now: at(11, 23, 15), costOf, createProjectResolver, samples });
  assert.equal(report.start, '2026-11-16');
  assert.equal(report.end, '2026-11-22');
  assert.equal(report.previousStart, '2026-11-09');
  assert.equal(report.tokens, 1000);
  assert.equal(report.costUsd, 9.8);
  assert.equal(report.unpricedTokens, 20);
  assert.equal(report.sessions, 5);
  assert.equal(report.activeDays, 5);
  assert.deepEqual(report.busiestDay, { day: '2026-11-18', tokens: 800 });
  assert.deepEqual(report.busiestHour, { hour: 14, tokens: 800 });
  assert.equal(report.previousTokens, 400);
  assert.deepEqual(report.quotaLow, { usedPercent: 88, at: at(11, 20, 21, 10) });
  // 前三个模型，其余两个并成一行；有未定价的一并时费用记 null
  assert.deepEqual(report.models.map((row) => [row.model, row.tokens, row.other || 0]), [
    ['claude-opus-5-5', 600, 0],
    ['claude-fable-5-2', 300, 0],
    ['claude-sonnet-5-5', 50, 0],
    [null, 50, 2]
  ]);
  assert.equal(report.models[3].costUsd, null);
  // 子目录并进上级项目
  assert.deepEqual(report.projects.map((row) => [row.name, row.tokens]), [
    ['beta', 800],
    ['alpha', 100],
    ['gamma', 50],
    [null, 50]
  ]);
  assert.equal(report.projects[0].sessions, 1);
  assert.equal(report.projects[3].other, 2);
});

test('an empty week still gives the dates, with nothing to rank', () => {
  const report = recap.buildWeeklyReport([], { now: at(11, 23, 15) });
  assert.equal(report.tokens, 0);
  assert.equal(report.busiestDay, null);
  assert.equal(report.busiestHour, null);
  assert.deepEqual(report.models, []);
  assert.deepEqual(report.projects, []);
  assert.equal(report.quotaLow, null);
});

test('five-hour windows come from the reset times in the samples, with the highest used percent seen', () => {
  const reset1 = at(11, 22, 14, 12);
  const reset2 = at(11, 22, 21, 5);
  const samples = [
    { t: reset1 - 4 * HOUR, five: 10, fiveReset: reset1 },
    { t: reset1 - 2 * HOUR, five: 55, fiveReset: reset1 + 40_000 },
    { t: reset1 - 10 * 60_000, five: 78, fiveReset: reset1 - 90_000 },
    // 窗口结束后还挂着的旧值：不算
    { t: reset1 + 30 * 60_000, five: 78, fiveReset: reset1 },
    { t: reset2 - 3 * HOUR, five: 0, fiveReset: reset2 },
    { t: reset2 - HOUR, five: 34, fiveReset: reset2 },
    // 没有 5 小时限制（GPT 现在不限）：five 是 null
    { t: reset2 + HOUR, five: null, fiveReset: null },
    // 一个用量为 0 的窗口不算
    { t: at(11, 23, 2), five: 0, fiveReset: at(11, 23, 5) }
  ];
  const windows = recap.fiveHourWindows(samples, { since: at(11, 1) });
  assert.deepEqual(windows, [
    { startAt: reset1 - 5 * HOUR, endAt: reset1, peak: 78 },
    { startAt: reset2 - 5 * HOUR, endAt: reset2, peak: 34 }
  ]);
  assert.deepEqual(recap.fiveHourWindows(samples, { since: at(11, 22, 18) }).map((item) => item.peak), [34]);
  assert.deepEqual(recap.fiveHourWindows(null), []);
});
