const fs = require('fs/promises');

const DEFAULT_CHUNK_SIZE = 1024 * 1024;

async function readTranscriptFile(file, cache, parseLines, { chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    return [];
  }

  const cached = cache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.fileSize === stat.size) {
    return cached.entries;
  }

  const canAppend = cached
    && stat.size > cached.fileSize
    && stat.mtimeMs >= cached.mtimeMs
    && cached.offset <= cached.fileSize;
  const start = canAppend ? cached.offset : 0;
  const parseState = canAppend ? cached.parseState || {} : {};
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

  cache.set(file, {
    mtimeMs: stat.mtimeMs,
    fileSize: stat.size,
    offset,
    entries,
    parseState
  });
  return entries;
}

module.exports = { readTranscriptFile };
