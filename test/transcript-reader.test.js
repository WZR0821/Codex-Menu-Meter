const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { readTranscriptFile } = require('../src/transcript-reader');

function parseTestLines(raw, state) {
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      state.count = (state.count || 0) + 1;
      return JSON.parse(line);
    });
}

test('streams transcripts across chunks and only parses appended bytes', async (context) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cmm-transcript-'));
  const file = path.join(dir, 'rollout.jsonl');
  context.after(() => fs.rm(dir, { recursive: true, force: true }));

  await fs.writeFile(file, '{"id":1,"value":"abcdefghijk"}\n{"id":2}\n', 'utf8');
  const cache = new Map();
  const initial = await readTranscriptFile(file, cache, parseTestLines, { chunkSize: 7 });
  assert.deepEqual(initial.map((entry) => entry.id), [1, 2]);
  assert.equal(cache.get(file).parseState.count, 2);

  await fs.appendFile(file, '{"id":3}\n{"id":4', 'utf8');
  const appended = await readTranscriptFile(file, cache, parseTestLines, { chunkSize: 5 });
  assert.deepEqual(appended.map((entry) => entry.id), [1, 2, 3]);
  assert.equal(cache.get(file).parseState.count, 3);

  await fs.appendFile(file, '}\n', 'utf8');
  const completed = await readTranscriptFile(file, cache, parseTestLines, { chunkSize: 3 });
  assert.deepEqual(completed.map((entry) => entry.id), [1, 2, 3, 4]);
  assert.equal(cache.get(file).parseState.count, 4);
});

test('drops entries older than the retention window from the cache', async (context) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cmm-transcript-'));
  const file = path.join(dir, 'rollout.jsonl');
  context.after(() => fs.rm(dir, { recursive: true, force: true }));

  const cutoff = 1_000;
  await fs.writeFile(file, '{"id":1,"ts":10}\n{"id":2,"ts":900}\n{"id":3,"ts":1000}\n', 'utf8');
  const cache = new Map();
  const initial = await readTranscriptFile(file, cache, parseTestLines, { retainFromTs: cutoff });
  assert.deepEqual(initial.map((entry) => entry.id), [3]);
  assert.deepEqual(cache.get(file).entries.map((entry) => entry.id), [3]);

  // 追加解析只重新读取新增字节，被裁掉的旧条目不能再回来。
  await fs.appendFile(file, '{"id":4,"ts":5000}\n', 'utf8');
  const appended = await readTranscriptFile(file, cache, parseTestLines, { retainFromTs: cutoff });
  assert.deepEqual(appended.map((entry) => entry.id), [3, 4]);
  assert.equal(cache.get(file).parseState.count, 4);
});

test('ages unchanged files out of cache and filters out-of-order history', async (context) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cmm-retention-'));
  context.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'session.jsonl');
  await fs.writeFile(file, '{"id":1,"ts":2000}\n{"id":2,"ts":500}\n{"id":3,"ts":3000}\n');
  const cache = new Map();
  assert.deepEqual((await readTranscriptFile(file, cache, parseTestLines, { retainFromTs: 1000 })).map(e => e.id), [1, 3]);
  assert.deepEqual((await readTranscriptFile(file, cache, parseTestLines, { retainFromTs: 2500 })).map(e => e.id), [3]);
  assert.equal(cache.get(file).parseState.count, 3);
});

test('replacing a transcript with a larger file starts parsing from zero', async (context) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cmm-replaced-'));
  context.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'session.jsonl');
  const replacement = path.join(dir, 'replacement.jsonl');
  const cache = new Map();
  await fs.writeFile(file, '{"id":1}\n');
  await readTranscriptFile(file, cache, parseTestLines);
  await fs.writeFile(replacement, '{"id":2}\n{"id":3}\n');
  await fs.rename(replacement, file);
  assert.deepEqual((await readTranscriptFile(file, cache, parseTestLines)).map(e => e.id), [2, 3]);
});
