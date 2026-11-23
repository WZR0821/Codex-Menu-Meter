const fs = require('fs/promises');
const { createReadStream } = require('fs');
const { pipeline } = require('stream');
const zlib = require('zlib');

const DEFAULT_CHUNK_SIZE = 1024 * 1024;
// Electron 43 自带的 Node 24 才有 zstd；拿不到时压缩档按读不到处理，不影响明文日志。
const zstdAvailable = typeof zlib.createZstdDecompress === 'function';

function retainRecentEntries(entries, retainFromTs) {
  if (!Number.isFinite(retainFromTs)) return entries;
  // 长会话文件会一路追加，缓存里只留统计窗口内的条目，避免旧条目长期占内存。
  return entries.filter((entry) => Number(entry?.ts) >= retainFromTs);
}

function isCompressedTranscript(file) {
  return String(file).endsWith('.zst');
}

// 压缩档流式解压，按 chunkSize 一块、在换行处切开逐块解析（2.0.0）。以前整份解压：
// 几百 MB 的会话解压后近 1 GB，内存一下冲到近 2 GB；按 1 MB 一块流式处理速度一样，峰值只有一两百 MB。
// 每块之间自然让出事件循环；最后一行不必以换行结尾（压缩档里的内容是完整的）。
async function parseCompressedFile(file, parseLines, chunkSize) {
  const entries = [];
  const parseState = {};
  // zlib 的输出块不能小于 64 字节（测试里会用很小的块来覆盖跨块的行）。
  const decompress = zlib.createZstdDecompress({ chunkSize: Math.max(64, chunkSize) });
  // 读文件或解压出错时 pipeline 会带着错误销毁解压流，下面的 for await 随之抛出；提前退出时也会关掉文件。
  pipeline(createReadStream(file, { highWaterMark: chunkSize }), decompress, () => {});
  let pending = Buffer.alloc(0);
  for await (const chunk of decompress) {
    const combined = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    const lastNewline = combined.lastIndexOf(0x0a);
    if (lastNewline < 0) {
      pending = Buffer.from(combined);
      continue;
    }
    for (const entry of parseLines(combined.subarray(0, lastNewline + 1).toString('utf8'), parseState)) entries.push(entry);
    pending = Buffer.from(combined.subarray(lastNewline + 1));
  }
  if (pending.length) {
    for (const entry of parseLines(pending.toString('utf8'), parseState)) entries.push(entry);
  }
  return entries;
}

// Codex 会把闲置一阵的会话压成同名的 .jsonl.zst 并删掉原文件。压缩档不会再追加，
// 解析一次后按文件身份缓存。
async function readCompressedTranscript(file, stat, cache, parseLines, { chunkSize, retainFromTs }) {
  if (!zstdAvailable) return [];
  let entries;
  try {
    entries = await parseCompressedFile(file, parseLines, chunkSize);
  } catch {
    return [];
  }
  const retained = retainRecentEntries(entries, retainFromTs);
  cache.set(file, {
    dev: stat.dev,
    ino: stat.ino,
    mtimeMs: stat.mtimeMs,
    fileSize: stat.size,
    offset: stat.size,
    entries: retained,
    parseState: null,
    compressed: true
  });
  return retained;
}

async function readTranscriptFile(file, cache, parseLines, {
  chunkSize = DEFAULT_CHUNK_SIZE,
  retainFromTs = null
} = {}) {
  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    return [];
  }

  const cached = cache.get(file);
  const sameFile = cached && cached.dev === stat.dev && cached.ino === stat.ino;
  if (sameFile && cached.mtimeMs === stat.mtimeMs && cached.fileSize === stat.size) {
    cached.entries = retainRecentEntries(cached.entries, retainFromTs);
    return cached.entries;
  }
  if (isCompressedTranscript(file)) {
    return readCompressedTranscript(file, stat, cache, parseLines, { chunkSize, retainFromTs });
  }

  const canAppend = sameFile
    && !cached.compressed
    && stat.size > cached.fileSize
    && stat.mtimeMs >= cached.mtimeMs
    && cached.offset <= cached.fileSize;
  const start = canAppend ? cached.offset : 0;
  // Parse transactionally: a failed read must not advance the cached parser state.
  const parseState = canAppend ? structuredClone(cached.parseState || {}) : {};
  const entries = canAppend ? cached.entries.slice() : [];

  let offset = start;
  let pending = Buffer.alloc(0);
  let handle;
  try {
    handle = await fs.open(file, 'r');
    let position = start;
    while (position < stat.size) {
      const requested = Math.min(chunkSize, stat.size - position);
      const chunk = Buffer.allocUnsafe(requested);
      const { bytesRead } = await handle.read(chunk, 0, requested, position);
      if (bytesRead <= 0) break;

      position += bytesRead;
      const bytes = bytesRead === requested ? chunk : chunk.subarray(0, bytesRead);
      const combined = pending.length ? Buffer.concat([pending, bytes]) : bytes;
      const lastNewline = combined.lastIndexOf(0x0a);
      if (lastNewline < 0) {
        pending = Buffer.from(combined);
        continue;
      }

      entries.push(...parseLines(combined.subarray(0, lastNewline + 1).toString('utf8'), parseState));
      pending = Buffer.from(combined.subarray(lastNewline + 1));
      offset = position - pending.length;
    }
  } catch {
    return canAppend ? cached.entries : [];
  } finally {
    await handle?.close().catch(() => {});
  }

  const retained = retainRecentEntries(entries, retainFromTs);
  cache.set(file, {
    dev: stat.dev,
    ino: stat.ino,
    mtimeMs: stat.mtimeMs,
    fileSize: stat.size,
    offset,
    entries: retained,
    parseState
  });
  return retained;
}

// 只读一遍、不进缓存：历史回填（2.0.0）用它把窗口外的旧日志也过一遍，读完就丢。
// 明文日志照常分块读，压缩档流式解压，几百 MB 的会话也不会整份进内存。
async function readTranscriptOnce(file, parseLines, { chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
  if (!isCompressedTranscript(file)) return readTranscriptFile(file, new Map(), parseLines, { chunkSize });
  if (!zstdAvailable) return [];
  try {
    return await parseCompressedFile(file, parseLines, chunkSize);
  } catch {
    return [];
  }
}

// 压缩档缓存落盘用：只有压缩档值得跨启动保留（明文日志还在追加，下次启动照常增量读）。
function exportCompressedCache(cache, retainFromTs) {
  const files = {};
  for (const [file, record] of cache) {
    if (!record?.compressed) continue;
    files[file] = {
      dev: record.dev,
      ino: record.ino,
      mtimeMs: record.mtimeMs,
      fileSize: record.fileSize,
      entries: retainRecentEntries(record.entries, retainFromTs)
    };
  }
  return files;
}

function importCompressedCache(cache, files) {
  if (!files || typeof files !== 'object') return 0;
  let count = 0;
  for (const [file, record] of Object.entries(files)) {
    if (!isCompressedTranscript(file) || !record || !Array.isArray(record.entries)) continue;
    if (![record.dev, record.ino, record.mtimeMs, record.fileSize].every(Number.isFinite)) continue;
    cache.set(file, {
      dev: record.dev,
      ino: record.ino,
      mtimeMs: record.mtimeMs,
      fileSize: record.fileSize,
      offset: record.fileSize,
      entries: record.entries,
      parseState: null,
      compressed: true
    });
    count += 1;
  }
  return count;
}

module.exports = {
  readTranscriptFile,
  readTranscriptOnce,
  isCompressedTranscript,
  exportCompressedCache,
  importCompressedCache
};
