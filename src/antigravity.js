// Google Antigravity 的额度和本机 token 记录（2.1.0）。
//
// 额度：Antigravity 运行时在本机起一个语言服务，把端口和访问令牌写在
// ~/.gemini/antigravity/daemon/hub_<端口>.json（只有本人可读）。用它调两个只读接口：
//   RetrieveUserQuotaSummary：分组额度。每组（Gemini、Claude/GPT）各有一周和 5 小时两个窗口，
//     给的是剩余比例 remainingFraction 和重置时间 resetTime；
//   GetUserStatus：套餐（userTier）。返回里还有姓名和邮箱，这里只取套餐名，别的不进状态。
// 只连 127.0.0.1；令牌只放在请求头里，不写日志、不进状态、不给手机。
// Antigravity 没开时语言服务不在，额度读不到（报 antigravity-not-running），已读到的数字保留并标「数据截至」。
//
// token：每个会话一个 SQLite（~/.gemini/antigravity/conversations/<会话>.db）。gen_metadata 表每行是一次模型生成
// （CortexStepGeneratorMetadata），里面 ChatModelMetadata.usage 是 ModelUsageStats：
// 未缓存输入、缓存写、缓存读、输出（含思考）。时间取这次生成对应步骤（steps 表）的 created_at。
// 字段号是从 Antigravity 2.35.2 语言服务自带的协议描述里读出来的，见文件末尾的 FIELD。
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { fileURLToPath } = require('url');

const LS_SERVICE_PATH = '/exa.language_server_pb.LanguageServerService/';
const LS_TIMEOUT_MS = 8_000;
const LS_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const REQUEST_METADATA = Object.freeze({ metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' } });

// 主分组：大数字和曲线跟着它走。Antigravity 里 Gemini 是默认模型，其余（Claude、GPT-OSS）是另一组。
const MAIN_GROUP_KEY = 'gemini';

function antigravityRoot(home = os.homedir()) {
  return path.join(home, '.gemini', 'antigravity');
}

function codedError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ---- 找语言服务 ----

function isProcessAlive(pid) {
  const value = Number(pid);
  if (!Number.isInteger(value) || value <= 0) return false;
  try {
    process.kill(value, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function validPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65_536 ? port : null;
}

function normalizeHub(info) {
  if (!info || typeof info !== 'object') return null;
  const httpPort = validPort(info.httpPort);
  const httpsPort = validPort(info.httpsPort);
  const csrfToken = typeof info.csrfToken === 'string' ? info.csrfToken.trim() : '';
  if ((!httpPort && !httpsPort) || !csrfToken) return null;
  return {
    pid: Number(info.pid) || null,
    httpPort,
    httpsPort,
    csrfToken,
    version: typeof info.lsVersion === 'string' ? info.lsVersion.slice(0, 40) : null
  };
}

// 退出不干净时会留下旧的 hub 文件：只认进程还活着的，几个都活着取最新写的。
async function findLanguageServer({ root = antigravityRoot(), isAlive = isProcessAlive } = {}) {
  const dir = path.join(root, 'daemon');
  let names;
  try {
    names = await fs.readdir(dir);
  } catch {
    return null;
  }
  const candidates = [];
  for (const name of names) {
    if (!/^hub_\d+\.json$/.test(name)) continue;
    const file = path.join(dir, name);
    try {
      const [raw, stat] = await Promise.all([fs.readFile(file, 'utf8'), fs.stat(file)]);
      const hub = normalizeHub(JSON.parse(raw));
      if (hub && (!hub.pid || isAlive(hub.pid))) candidates.push({ ...hub, mtimeMs: stat.mtimeMs });
    } catch {
      // 正在被改写或格式不对：跳过这一个。
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
}

function postOnce(transport, port, hub, method, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = transport.request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: `${LS_SERVICE_PATH}${method}`,
      // https 那个端口是自签证书；只连本机回环地址，不校验证书。
      rejectUnauthorized: false,
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        'X-Codeium-Csrf-Token': hub.csrfToken,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > LS_MAX_RESPONSE_BYTES) {
          request.destroy(codedError('antigravity-bad-data'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          const error = new Error(`HTTP ${response.statusCode}`);
          error.status = response.statusCode;
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(codedError('antigravity-bad-data'));
        }
      });
      response.on('error', reject);
    });
    request.on('timeout', () => {
      const error = new Error('timeout');
      error.name = 'AbortError';
      request.destroy(error);
    });
    request.on('error', reject);
    request.end(payload);
  });
}

// 先走明文端口（127.0.0.1 上没有证书问题），连不上再试 https 端口。HTTP 错误码不换端口重试。
async function callLanguageServer(hub, method, body = REQUEST_METADATA, { timeoutMs = LS_TIMEOUT_MS } = {}) {
  const payload = JSON.stringify(body || {});
  const routes = [];
  if (hub.httpPort) routes.push([http, hub.httpPort]);
  if (hub.httpsPort) routes.push([https, hub.httpsPort]);
  let lastError = null;
  for (const [transport, port] of routes) {
    try {
      return await postOnce(transport, port, hub, method, payload, timeoutMs);
    } catch (error) {
      lastError = error;
      if (error?.status || error?.code === 'antigravity-bad-data') throw error;
    }
  }
  if (lastError?.code === 'ECONNREFUSED') throw codedError('antigravity-not-running');
  throw lastError || codedError('antigravity-not-running');
}

// ---- 额度 ----

function groupKeyOf(group) {
  const ids = (Array.isArray(group?.buckets) ? group.buckets : []).map((bucket) => String(bucket?.bucketId || ''));
  const prefix = ids.map((id) => id.split('-')[0]).find(Boolean) || '';
  const text = `${group?.displayName || ''} ${group?.description || ''}`;
  if (prefix.toLowerCase() === 'gemini' || (!prefix && /gemini/i.test(text))) return 'gemini';
  if (prefix) return prefix.toLowerCase();
  if (/claude|gpt/i.test(text)) return '3p';
  return String(group?.displayName || 'group').toLowerCase().replace(/\s+/g, '-').slice(0, 24);
}

function groupLabelOf(group, key) {
  if (key === 'gemini') return 'Gemini';
  const name = String(group?.displayName || '').trim();
  if (key === '3p' || /claude|gpt/i.test(name)) {
    const hasClaude = /claude/i.test(`${name} ${group?.description || ''}`);
    const hasGpt = /gpt/i.test(`${name} ${group?.description || ''}`);
    if (hasClaude && hasGpt) return 'Claude/GPT';
    if (hasClaude) return 'Claude';
    if (hasGpt) return 'GPT';
  }
  return name.replace(/\s+models?$/i, '').slice(0, 20) || 'Other';
}

function bucketKind(bucket) {
  const window = String(bucket?.window || '').toLowerCase();
  const id = String(bucket?.bucketId || '').toLowerCase();
  const name = String(bucket?.displayName || '').toLowerCase();
  if (window === '5h' || /-5h$/.test(id) || /five hour/.test(name)) return 'five';
  if (window === 'weekly' || window === 'week' || /-weekly$/.test(id) || /week/.test(name)) return 'week';
  return window || id || 'other';
}

// proto3 的 JSON 会省掉 0：用尽的窗口可能根本没有 remainingFraction。用过的窗口一定有重置时间，
// 所以「有重置时间、没剩余比例」按 0 算；两样都没有的不认。
// 剩余 100% 又没有重置时间：窗口还没开始（这一组还没用过），按 Claude 的 inactive 显示。
function bucketWindow(bucket) {
  if (!bucket || typeof bucket !== 'object') return null;
  const resetAt = Date.parse(bucket.resetTime);
  const hasReset = Number.isFinite(resetAt);
  let fraction = Number(bucket.remainingFraction);
  if (bucket.remainingFraction === undefined || bucket.remainingFraction === null || !Number.isFinite(fraction)) {
    if (!hasReset) return null;
    fraction = 0;
  }
  fraction = clamp(fraction, 0, 1);
  const usedPercent = clamp(Math.round((1 - fraction) * 100), 0, 100);
  const windowValue = {
    usedPercent,
    remainingPercent: 100 - usedPercent,
    resetAt: hasReset ? resetAt : null
  };
  if (!hasReset && fraction >= 1) windowValue.inactive = true;
  return windowValue;
}

function planLabelOf(status) {
  const tier = status?.userStatus?.userTier;
  const name = String(tier?.name || '').trim()
    .replace(/^google\s+antigravity\s+/i, '')
    .replace(/^antigravity\s+/i, '')
    .replace(/\s+quota$/i, '')
    .trim();
  return name ? name.slice(0, 32) : null;
}

// 映射到 GPT / Claude 的两张卡：
//   「一周」卡：大数字是 Gemini 的一周；另一组的一周并进卡里（大数字右侧 + 下面一道细条，同 Claude 的 Fable）。
//   「5 小时」卡：Gemini 有 5 小时窗口就用它，另一组的 5 小时同样并进来；Gemini 没有（免费档就没有）时
//     直接显示另一组的 5 小时，卡片标题后注明是哪一组。
// group 字段是卡片标题后的分组名；extraWindows 里的 fold 指明并进哪张卡，label 是显示名，
// name 是历史采样和提醒用的唯一键（一周就是组名，5 小时加「 · 5h」）。
function normalizeAntigravityUsage(summary, status = null) {
  const rawGroups = Array.isArray(summary?.response?.groups)
    ? summary.response.groups
    : Array.isArray(summary?.groups) ? summary.groups : [];
  const groups = [];
  for (const group of rawGroups) {
    if (!group || typeof group !== 'object') continue;
    const key = groupKeyOf(group);
    const label = groupLabelOf(group, key);
    const windows = { five: null, week: null, others: [] };
    for (const bucket of Array.isArray(group.buckets) ? group.buckets : []) {
      const windowValue = bucketWindow(bucket);
      if (!windowValue) continue;
      const kind = bucketKind(bucket);
      if ((kind === 'five' || kind === 'week') && !windows[kind]) windows[kind] = windowValue;
      else windows.others.push({ ...windowValue, kind });
    }
    if (windows.five || windows.week || windows.others.length) groups.push({ key, label, ...windows });
  }
  if (!groups.length) return null;

  const main = groups.find((group) => group.key === MAIN_GROUP_KEY) || groups[0];
  const others = groups.filter((group) => group !== main);
  const fiveGroup = main.five ? main : others.find((group) => group.five) || null;
  const weekGroup = main.week ? main : others.find((group) => group.week) || null;
  const primaryWindow = fiveGroup ? { ...fiveGroup.five, group: fiveGroup.label } : null;
  const secondaryWindow = weekGroup ? { ...weekGroup.week, group: weekGroup.label } : null;

  const extraWindows = [];
  for (const group of groups) {
    // shortLabel：手机窄屏上大数字右侧放不下「Claude/GPT」时用的短名。
    const shortLabel = group.label === 'Claude/GPT' ? 'Claude' : group.label;
    if (group.week && group !== weekGroup) {
      extraWindows.push({ ...group.week, name: group.label, label: group.label, shortLabel, fold: 'week', group: group.label });
    }
    if (group.five && group !== fiveGroup) {
      extraWindows.push({ ...group.five, name: `${group.label} · 5h`, label: group.label, shortLabel, fold: 'five', group: group.label });
    }
    for (const other of group.others) {
      const { kind, ...windowValue } = other;
      extraWindows.push({ ...windowValue, name: `${group.label} · ${String(kind).slice(0, 12)}`, label: group.label, group: group.label });
    }
  }
  // 只有一组时卡片标题不必注明分组。
  if (groups.length === 1) {
    if (primaryWindow) delete primaryWindow.group;
    if (secondaryWindow) delete secondaryWindow.group;
  }
  return {
    planType: planLabelOf(status),
    limitReached: [primaryWindow, secondaryWindow, ...extraWindows].some((item) => item && item.usedPercent >= 100),
    primaryWindow,
    secondaryWindow,
    extraWindows
  };
}

async function readAntigravityUsage({ root = antigravityRoot(), isAlive = isProcessAlive, call = callLanguageServer } = {}) {
  const hub = await findLanguageServer({ root, isAlive });
  if (!hub) throw codedError('antigravity-not-running');
  const [summary, status] = await Promise.all([
    call(hub, 'RetrieveUserQuotaSummary').catch((error) => ({ error })),
    // 套餐只是标题上的一个标注，读不到不能拖住额度本身。
    call(hub, 'GetUserStatus', REQUEST_METADATA, { timeoutMs: 6_000 }).catch(() => null)
  ]);
  if (summary?.error) throw summary.error;
  const usage = normalizeAntigravityUsage(summary, status);
  if (!usage) throw codedError('antigravity-bad-data');
  return usage;
}

// ---- 本机 token 记录 ----

// 极简 protobuf 读取：这里用到的字段只有 varint 和长度前缀两种线型，64/32 位定长字段按长度跳过。
// 数值按 JS Number 累加：token 数远小于 2^53，超大的 varint（比如 uint64 最大值）只是被跳过，精度无所谓。
function readVarint(buffer, offset) {
  let value = 0;
  let factor = 1;
  let position = offset;
  for (let count = 0; count < 10; count += 1) {
    if (position >= buffer.length) throw new Error('truncated varint');
    const byte = buffer[position++];
    value += (byte & 0x7f) * factor;
    if (!(byte & 0x80)) return [value, position];
    factor *= 128;
  }
  throw new Error('varint too long');
}

function decodeMessage(buffer) {
  const fields = new Map();
  if (!buffer || !buffer.length) return fields;
  let position = 0;
  while (position < buffer.length) {
    let tag;
    [tag, position] = readVarint(buffer, position);
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (!field) throw new Error('bad field');
    let value;
    if (wire === 0) {
      [value, position] = readVarint(buffer, position);
    } else if (wire === 2) {
      let length;
      [length, position] = readVarint(buffer, position);
      if (position + length > buffer.length) throw new Error('truncated field');
      value = buffer.subarray(position, position + length);
      position += length;
    } else if (wire === 1) {
      position += 8;
      continue;
    } else if (wire === 5) {
      position += 4;
      continue;
    } else {
      throw new Error('unsupported wire type');
    }
    if (!fields.has(field)) fields.set(field, []);
    fields.get(field).push(value);
  }
  return fields;
}

function firstValue(fields, field) {
  return fields.get(field)?.[0];
}

function messageField(fields, field) {
  const value = firstValue(fields, field);
  if (!Buffer.isBuffer(value)) return null;
  try {
    return decodeMessage(value);
  } catch {
    return null;
  }
}

function stringField(fields, field) {
  const value = firstValue(fields, field);
  return Buffer.isBuffer(value) ? value.toString('utf8') : '';
}

function numberField(fields, field) {
  const value = firstValue(fields, field);
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function timestampMs(fields) {
  if (!fields) return null;
  const seconds = numberField(fields, 1);
  const nanos = numberField(fields, 2);
  if (!seconds) return null;
  return seconds * 1000 + Math.floor(nanos / 1e6);
}

// repeated uint32 可能是打包的（一个长度前缀字段）也可能是逐个的 varint，两种都认。
function repeatedVarints(fields, field) {
  const out = [];
  for (const value of fields.get(field) || []) {
    if (typeof value === 'number') {
      out.push(value);
      continue;
    }
    let position = 0;
    try {
      while (position < value.length) {
        let item;
        [item, position] = readVarint(value, position);
        out.push(item);
      }
    } catch {
      // 半截数据：已读出的照用。
    }
  }
  return out;
}

const FIELD = Object.freeze({
  // CortexStepGeneratorMetadata
  generatorChatModel: 1,
  generatorStepIndices: 2,
  generatorExecutionId: 4,
  // ChatModelMetadata
  chatUsage: 4,
  chatResponseModel: 19,
  chatCustomMetadata: 20,
  chatModelDisplayName: 21,
  chatResponseModelFull: 22,
  // ModelUsageStats
  usageInput: 2,
  usageOutput: 3,
  usageCacheWrite: 4,
  usageCacheRead: 5,
  usageMessageId: 7,
  usageThinking: 9,
  usageResponse: 10,
  usageResponseId: 11,
  // CortexStepMetadata
  stepCreatedAt: 1
});

function customMetadata(fields) {
  const map = {};
  for (const value of fields.get(FIELD.chatCustomMetadata) || []) {
    if (!Buffer.isBuffer(value)) continue;
    try {
      const entry = decodeMessage(value);
      const key = stringField(entry, 1);
      if (key) map[key] = stringField(entry, 2);
    } catch {
      // 跳过坏条目。
    }
  }
  return map;
}

// 显示名「Gemini 4 Hydrogen (High)」→ gemini-4-hydrogen：只在没有 response_model 时兜底。
function modelIdFromDisplay(name) {
  return String(name || '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function parseGeneration(data) {
  let generator;
  try {
    generator = decodeMessage(data);
  } catch {
    return null;
  }
  const chat = messageField(generator, FIELD.generatorChatModel);
  if (!chat) return null;
  const usage = messageField(chat, FIELD.chatUsage);
  if (!usage) return null;
  const input = numberField(usage, FIELD.usageInput);
  const cacheWrite = numberField(usage, FIELD.usageCacheWrite);
  const cacheRead = numberField(usage, FIELD.usageCacheRead);
  const thinking = numberField(usage, FIELD.usageThinking);
  const response = numberField(usage, FIELD.usageResponse);
  // output_tokens 已含思考；旧记录只有分项时按分项相加。
  const output = Math.max(numberField(usage, FIELD.usageOutput), thinking + response);
  const custom = customMetadata(chat);
  const model = stringField(chat, FIELD.chatResponseModel).trim()
    || stringField(chat, FIELD.chatResponseModelFull).trim()
    || modelIdFromDisplay(stringField(chat, FIELD.chatModelDisplayName));
  const lastStep = Number.parseInt(custom.last_step_index, 10);
  return {
    stepIndices: repeatedVarints(generator, FIELD.generatorStepIndices),
    lastStepIndex: Number.isInteger(lastStep) ? lastStep : null,
    responseId: stringField(usage, FIELD.usageResponseId) || stringField(usage, FIELD.usageMessageId) || '',
    model: model.slice(0, 80) || null,
    input,
    cacheWrite,
    cacheRead,
    output
  };
}

function parseStepCreatedAt(metadata) {
  try {
    return timestampMs(messageField(decodeMessage(metadata), FIELD.stepCreatedAt));
  } catch {
    return null;
  }
}

function toBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

// rows：gen_metadata 的 { idx, data }；steps：steps 的 { idx, metadata }。
// 口径和 Claude 对齐：总量 = 未缓存输入 + 缓存写 + 缓存读 + 输出；命中 = 缓存读 / 总输入；读写 = 未缓存输入 + 缓存写 + 输出。
// 加权按 Gemini 牌价的大致比例：输出 6×、缓存读 0.1×（隐式缓存不收写入费，缓存写按输入算）。
function entriesFromRows(rows, steps, { sessionId = null, cwd = null, fallbackTs = null } = {}) {
  const stepTimes = new Map();
  for (const step of steps || []) {
    const ts = parseStepCreatedAt(toBuffer(step.metadata));
    if (ts) stepTimes.set(Number(step.idx), ts);
  }
  const entries = [];
  let lastTs = null;
  for (const row of rows || []) {
    const generation = parseGeneration(toBuffer(row.data));
    if (!generation) continue;
    const tokens = generation.input + generation.cacheWrite + generation.cacheRead + generation.output;
    if (tokens <= 0) continue;
    let ts = null;
    for (const index of [...generation.stepIndices, generation.lastStepIndex]) {
      if (index === null || index === undefined) continue;
      ts = stepTimes.get(Number(index)) || null;
      if (ts) break;
    }
    ts = ts || lastTs || fallbackTs;
    if (!ts) continue;
    lastTs = ts;
    const totalInput = generation.input + generation.cacheWrite + generation.cacheRead;
    entries.push({
      id: generation.responseId ? `ag:${generation.responseId}` : `ag:${sessionId || '?'}:${row.idx}`,
      ts,
      tokens,
      inputTokens: totalInput,
      cachedInputTokens: generation.cacheRead,
      weighted: generation.input + generation.cacheWrite + generation.output * 6 + generation.cacheRead * 0.1,
      ioTokens: generation.input + generation.cacheWrite + generation.output,
      baseInputTokens: generation.input,
      cacheWrite5mTokens: generation.cacheWrite,
      cacheWrite1hTokens: 0,
      outputTokens: generation.output,
      speed: 'standard',
      model: generation.model,
      sessionId,
      cwd
    });
  }
  return entries;
}

function loadSqlite() {
  try {
    return require('node:sqlite').DatabaseSync;
  } catch {
    throw codedError('antigravity-sqlite-unavailable');
  }
}

// Antigravity 开着时数据库处在 WAL 模式、随时在写：复制一份（连同 -wal）到临时目录再读，
// 不在它的目录里留下我们的 -shm，也不和它抢锁。复制不是原子的，偶尔读到半截就等下一轮。
async function withSnapshot(file, tmpDir, read) {
  await fs.mkdir(tmpDir, { recursive: true, mode: 0o700 });
  const copy = path.join(tmpDir, `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`);
  try {
    await fs.copyFile(file, copy);
    try {
      await fs.copyFile(`${file}-wal`, `${copy}-wal`);
    } catch {
      // 没有 -wal：数据都在主文件里。
    }
    return read(copy);
  } finally {
    await Promise.all([copy, `${copy}-wal`, `${copy}-shm`].map((item) => fs.rm(item, { force: true }).catch(() => {})));
  }
}

function queryAll(DatabaseSync, file, statements) {
  const db = new DatabaseSync(file);
  try {
    return statements.map((sql) => {
      try {
        return db.prepare(sql).all();
      } catch {
        return [];
      }
    });
  } finally {
    db.close();
  }
}

function workspacePath(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  for (const part of text.split(/[\n,;]+/)) {
    const item = part.trim().replace(/^"|"$/g, '');
    if (!item) continue;
    if (item.startsWith('file://')) {
      try {
        return fileURLToPath(item);
      } catch {
        continue;
      }
    }
    if (item.startsWith('/')) return item;
  }
  return null;
}

async function fileSignature(file) {
  const stat = await fs.stat(file);
  let wal = '';
  try {
    const walStat = await fs.stat(`${file}-wal`);
    wal = `${walStat.mtimeMs}:${walStat.size}`;
  } catch {
    // 没有 -wal。
  }
  return { mtimeMs: Math.max(stat.mtimeMs, wal ? Number(wal.split(':')[0]) : 0), key: `${stat.mtimeMs}:${stat.size}:${wal}` };
}

// 按文件签名缓存每个会话的解析结果；会话摘要库（项目目录）也一样缓存。
function createAntigravityActivityReader({
  root = antigravityRoot(),
  tmpDir = path.join(os.tmpdir(), 'codex-menu-meter-antigravity'),
  sqlite = null
} = {}) {
  const conversationCache = new Map();
  let summaryCache = { key: null, workspaces: new Map() };

  async function readWorkspaces(DatabaseSync) {
    const file = path.join(root, 'conversation_summaries.db');
    let signature;
    try {
      signature = await fileSignature(file);
    } catch {
      return new Map();
    }
    if (summaryCache.key === signature.key) return summaryCache.workspaces;
    const workspaces = new Map();
    try {
      const [rows] = await withSnapshot(file, tmpDir, (copy) => queryAll(DatabaseSync, copy, [
        'SELECT conversation_id AS id, workspace_uris AS uris FROM conversation_summaries'
      ]));
      for (const row of rows) {
        const cwd = workspacePath(row.uris);
        if (row.id && cwd) workspaces.set(String(row.id), cwd);
      }
      summaryCache = { key: signature.key, workspaces };
    } catch {
      return summaryCache.workspaces;
    }
    return workspaces;
  }

  async function listConversationFiles() {
    const dir = path.join(root, 'conversations');
    try {
      return (await fs.readdir(dir)).filter((name) => /\.db$/.test(name)).map((name) => path.join(dir, name));
    } catch {
      return [];
    }
  }

  // sinceTs：最后改动早于它的会话里不会有更晚的记录（记录先产生、后写盘），不读。
  async function collect({ sinceTs = 0 } = {}) {
    const files = await listConversationFiles();
    if (!files.length) return [];
    const DatabaseSync = sqlite || loadSqlite();
    const workspaces = await readWorkspaces(DatabaseSync);
    const fileSet = new Set(files);
    for (const cached of conversationCache.keys()) {
      if (!fileSet.has(cached)) conversationCache.delete(cached);
    }
    const seen = new Set();
    const entries = [];
    for (const file of files) {
      let signature;
      try {
        signature = await fileSignature(file);
      } catch {
        continue;
      }
      if (sinceTs && signature.mtimeMs < sinceTs) continue;
      const sessionId = path.basename(file, '.db');
      const cwd = workspaces.get(sessionId) || null;
      let cached = conversationCache.get(file);
      if (!cached || cached.key !== signature.key || cached.cwd !== cwd) {
        try {
          const [rows, steps] = await withSnapshot(file, tmpDir, (copy) => queryAll(DatabaseSync, copy, [
            'SELECT idx, data FROM gen_metadata ORDER BY idx',
            'SELECT idx, metadata FROM steps'
          ]));
          cached = { key: signature.key, cwd, entries: entriesFromRows(rows, steps, { sessionId, cwd, fallbackTs: signature.mtimeMs }) };
          conversationCache.set(file, cached);
        } catch {
          // 复制时正好在写，或文件坏了：用上一次的结果，下一轮再读。
          if (!cached) continue;
        }
      }
      for (const entry of cached.entries) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        entries.push(entry);
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    return entries;
  }

  return { collect, root, cacheSize: () => conversationCache.size };
}

module.exports = {
  antigravityRoot,
  findLanguageServer,
  normalizeHub,
  callLanguageServer,
  normalizeAntigravityUsage,
  readAntigravityUsage,
  decodeMessage,
  parseGeneration,
  entriesFromRows,
  workspacePath,
  createAntigravityActivityReader,
  FIELD
};
