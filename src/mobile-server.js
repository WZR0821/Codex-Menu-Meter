const crypto = require('crypto');
const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const STATIC_FILES = new Map([
  ['/mobile/', 'index.html'],
  ['/mobile/index.html', 'index.html'],
  ['/mobile/app.css', 'app.css'],
  ['/mobile/runtime-config.js', 'runtime-config.js'],
  ['/mobile/cloud-sync-crypto.js', 'cloud-sync-crypto.js'],
  ['/mobile/usage-pace.js', 'usage-pace.js'],
  ['/mobile/token-week.js', 'token-week.js'],
  ['/mobile/mobile.js', 'mobile.js'],
  ['/mobile/manifest.webmanifest', 'manifest.webmanifest'],
  ['/mobile/icon.svg', 'icon.svg'],
  ['/mobile/apple-touch-icon.png', 'apple-touch-icon.png'],
  ['/mobile/icon-192.png', 'icon-192.png'],
  ['/mobile/icon-512.png', 'icon-512.png']
]);
const MOBILE_COOKIE_NAME = 'cmm_mobile_token';

function createAccessToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function findPreferredLanAddress(networkInterfaces) {
  const candidates = [];
  for (const [name, entries] of Object.entries(networkInterfaces || {})) {
    for (const entry of entries || []) {
      const family = entry.family === 4 ? 'IPv4' : entry.family;
      const address = String(entry.address || '');
      if (family !== 'IPv4' || entry.internal || !address || address.startsWith('169.254.')) continue;
      const interfaceRank = name === 'en0'
        ? 0
        : /^en\d+$/.test(name)
          ? 1
          : /^bridge\d+$/.test(name)
            ? 2
            : /^utun\d+$/.test(name)
              ? 5
              : 3;
      const privateRank = /^(10\.|192\.168\.)/.test(address)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
        ? 0
        : 1;
      candidates.push({ address, interfaceRank, privateRank });
    }
  }
  candidates.sort((left, right) => (
    left.interfaceRank - right.interfaceRank
    || left.privateRank - right.privateRank
    || left.address.localeCompare(right.address)
  ));
  return candidates[0]?.address || null;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// 到期时间两种写法都有：Claude 侧是毫秒数，Codex 侧是 ISO 字符串。
function safeTimestamp(value) {
  const number = safeNumber(value);
  if (number !== null) return number;
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

function sanitizeWindow(windowValue) {
  if (!windowValue || typeof windowValue !== 'object') return null;
  return {
    name: String(windowValue.name || ''),
    remainingPercent: safeNumber(windowValue.remainingPercent),
    usedPercent: safeNumber(windowValue.usedPercent),
    resetAt: safeNumber(windowValue.resetAt),
    inactive: Boolean(windowValue.inactive)
  };
}

function sanitizeUsageSlice(slice) {
  const data = slice?.data;
  return {
    status: String(slice?.status || 'idle'),
    error: slice?.error ? String(slice.error) : null,
    errorCode: slice?.errorCode ? String(slice.errorCode) : null,
    fetchedAt: safeNumber(slice?.fetchedAt),
    staleAfterMs: safeNumber(slice?.staleAfterMs),
    retryAt: safeNumber(slice?.retryAt),
    data: data ? {
      fiveHourUnlimited: Boolean(data.fiveHourUnlimited),
      planType: data.planType ? String(data.planType) : null,
      primaryWindow: sanitizeWindow(data.primaryWindow),
      secondaryWindow: sanitizeWindow(data.secondaryWindow),
      extraWindows: Array.isArray(data.extraWindows)
        ? data.extraWindows.map(sanitizeWindow).filter(Boolean)
        : [],
      resetCredits: data.resetCredits ? {
        availableCount: safeNumber(data.resetCredits.availableCount) || 0,
        error: data.resetCredits.error ? String(data.resetCredits.error) : null,
        unavailableReason: data.resetCredits.unavailableReason ? String(data.resetCredits.unavailableReason) : null,
        credits: Array.isArray(data.resetCredits.credits)
          ? data.resetCredits.credits.map((credit) => ({
              status: credit?.status ? String(credit.status) : 'unknown',
              title: credit?.title ? String(credit.title) : null,
              kind: credit?.kind ? String(credit.kind) : null,
              resetsLeft: safeNumber(credit?.resetsLeft),
              resetsTotal: safeNumber(credit?.resetsTotal),
              expiresAt: safeTimestamp(credit?.expiresAt)
            }))
          : []
      } : null
    } : null
  };
}

function sanitizeActivitySlice(slice) {
  const data = slice?.data;
  return {
    status: String(slice?.status || 'idle'),
    error: slice?.error ? String(slice.error) : null,
    fetchedAt: safeNumber(slice?.fetchedAt),
    data: data ? {
      source: data.source ? String(data.source) : null,
      units: data.units ? String(data.units) : null,
      windowDays: safeNumber(data.windowDays),
      windows: data.windows ? {
        fiveHour: sanitizeActivityWindow(data.windows.fiveHour),
        week: sanitizeActivityWindow(data.windows.week)
      } : null,
      days: Array.isArray(data.days) ? data.days.slice(-30).map((day) => ({
        day: String(day.day || ''),
        future: Boolean(day.future),
        value: safeNumber(day.value) || 0,
        tokens: safeNumber(day.tokens) || 0,
        ioTokens: safeNumber(day.ioTokens) || 0,
        inputTokens: safeNumber(day.inputTokens),
        cachedInputTokens: safeNumber(day.cachedInputTokens),
        threads: safeNumber(day.threads) || 0,
        costUsd: safeNumber(day.costUsd) || 0,
        models: Array.isArray(day.models) ? day.models.slice(0, 24).map((model) => ({
          model: String(model?.model || ''),
          value: safeNumber(model?.value ?? model?.tokens ?? model?.weighted) || 0
        })).filter((model) => model.model) : []
      })) : []
    } : null
  };
}

function sanitizeActivityWindow(windowValue) {
  if (!windowValue || typeof windowValue !== 'object') return null;
  return {
    startAt: safeNumber(windowValue.startAt),
    endAt: safeNumber(windowValue.endAt),
    basis: windowValue.basis === 'cycle' ? 'cycle' : 'rolling',
    tokens: safeNumber(windowValue.tokens) || 0,
    ioTokens: safeNumber(windowValue.ioTokens) || 0,
    inputTokens: safeNumber(windowValue.inputTokens),
    cachedInputTokens: safeNumber(windowValue.cachedInputTokens),
    threads: safeNumber(windowValue.threads) || 0
  };
}

function sanitizeIqItem(item) {
  return {
    label: String(item?.label || ''),
    modelLabel: String(item?.modelLabel || item?.label || ''),
    isLatest: Boolean(item?.isLatest),
    isCurrentGeneration: Boolean(item?.isCurrentGeneration),
    catalogOnly: Boolean(item?.catalogOnly),
    reasoningEffort: item?.reasoningEffort ? String(item.reasoningEffort) : null,
    score: safeNumber(item?.score),
    status: item?.status ? String(item.status) : 'unknown',
    passed: safeNumber(item?.passed),
    tasks: safeNumber(item?.tasks),
    costUsd: safeNumber(item?.costUsd),
    wallTimeHuman: item?.wallTimeHuman ? String(item.wallTimeHuman) : null,
    wallHours: safeNumber(item?.wallHours),
    averageCostUsd: safeNumber(item?.averageCostUsd ?? item?.avgCostUsd),
    averageTaskSeconds: safeNumber(item?.averageTaskSeconds ?? item?.avgTaskSeconds),
    averageTaskTimeHuman: item?.averageTaskTimeHuman ? String(item.averageTaskTimeHuman) : null,
    sampleCount24h: safeNumber(item?.sampleCount24h),
    sampleCount: safeNumber(item?.sampleCount),
    sampleBasis: item?.sampleBasis === 'graded' ? 'graded' : null,
    coverage: safeNumber(item?.coverage),
    benchmarkTasks: safeNumber(item?.benchmarkTasks),
    costKnownSamples: safeNumber(item?.costKnownSamples),
    costTotalSamples: safeNumber(item?.costTotalSamples),
    costBasis: item?.costBasis ? String(item.costBasis) : null,
    costPartial: Boolean(item?.costPartial),
    // 四题众测：四题合计费用、耗时和每题加权得分。
    totalCostUsd: safeNumber(item?.totalCostUsd),
    totalTaskSeconds: safeNumber(item?.totalTaskSeconds),
    taskScores: Array.isArray(item?.taskScores) ? item.taskScores.slice(0, 8).map((task) => ({
      key: String(task?.key || '').slice(0, 24),
      points: safeNumber(task?.points),
      max: safeNumber(task?.max)
    })).filter((task) => task.key) : [],
    recentScores: Array.isArray(item?.recentScores) ? item.recentScores.slice(-32).map((sample) => ({
      date: sample?.date ? String(sample.date) : null,
      score: safeNumber(sample?.score)
    })).filter((sample) => sample.score !== null) : []
  };
}

function sanitizeRadarSlice(slice, provider) {
  const data = slice?.data;
  const base = {
    status: String(slice?.status || 'idle'),
    error: slice?.error ? String(slice.error) : null,
    // 手机端靠它区分「雷达数据源已下线」和普通读取失败
    errorCode: slice?.errorCode ? String(slice.errorCode) : null,
    fetchedAt: safeNumber(slice?.fetchedAt),
    data: null
  };
  if (!data) return base;

  if (provider === 'claude') {
    base.data = {
      sourceUrl: data.sourceUrl ? String(data.sourceUrl) : null,
      updatedAt: data.updatedAt ? String(data.updatedAt) : null,
      iqUpdatedAt: data.iqUpdatedAt ? String(data.iqUpdatedAt) : null,
      items: Array.isArray(data.items) ? data.items.slice(0, 96).map(sanitizeIqItem) : [],
      quota: data.quota ? {
        updatedAt: data.quota.updatedAt ? String(data.quota.updatedAt) : null,
        chartLabel: data.quota.chartLabel ? String(data.quota.chartLabel) : null,
        note: data.quota.note ? String(data.quota.note) : null,
        baseH5: safeNumber(data.quota.baseH5),
        baseD7: safeNumber(data.quota.baseD7),
        usage: Array.isArray(data.quota.usage) ? data.quota.usage.map((row) => ({
          key: String(row?.key || ''),
          usedPercent: safeNumber(row?.usedPercent),
          resetText: row?.resetText ? String(row.resetText) : null
        })) : []
      } : null
    };
    return base;
  }

  base.data = {
    sourceUrl: data.sourceUrl ? String(data.sourceUrl) : null,
    monitoredAt: data.monitoredAt ? String(data.monitoredAt) : null,
    modelIq: data.modelIq ? {
      scoreMode: data.modelIq.scoreMode ? String(data.modelIq.scoreMode) : null,
      timestampBasis: data.modelIq.timestampBasis === 'read' ? 'read' : null,
      partial: Boolean(data.modelIq.partial),
      requestedCount: safeNumber(data.modelIq.requestedCount),
      receivedCount: safeNumber(data.modelIq.receivedCount),
      updatedAt: data.modelIq.updatedAt ? String(data.modelIq.updatedAt) : null,
      latestDate: data.modelIq.latestDate ? String(data.modelIq.latestDate) : null,
      roundTestedAt: data.modelIq.roundTestedAt ? String(data.modelIq.roundTestedAt) : null,
      items: Array.isArray(data.modelIq.items) ? data.modelIq.items.slice(0, 96).map(sanitizeIqItem) : []
    } : null,
    quotaRadar: data.quotaRadar ? {
      updatedAt: data.quotaRadar.updatedAt ? String(data.quotaRadar.updatedAt) : null,
      rows: Array.isArray(data.quotaRadar.rows) ? data.quotaRadar.rows.slice(0, 12).map((row) => ({
        tier: String(row?.tier || ''),
        five_h: safeNumber(row?.five_h),
        seven_d: safeNumber(row?.seven_d)
      })) : []
    } : null
  };
  return base;
}

const MOBILE_HISTORY_DAY_POINTS = 96;
const MOBILE_HISTORY_WEEK_POINTS = 84;

function roundPercent(value) {
  const number = safeNumber(value);
  return number === null ? null : Math.round(number * 10) / 10;
}

// 手机只画迷你曲线：抽稀到固定点数，百分比保留一位小数；首尾两点总是保留。
function sanitizeHistorySeries(samples, maxPoints) {
  if (!Array.isArray(samples) || !samples.length) return [];
  const step = Math.max(1, Math.ceil(samples.length / maxPoints));
  return samples
    .filter((_, index) => index % step === 0 || index === samples.length - 1)
    .map((sample) => {
      const point = { t: safeNumber(sample?.t), five: roundPercent(sample?.five), week: roundPercent(sample?.week) };
      if (sample?.ex && typeof sample.ex === 'object') {
        const ex = {};
        for (const [name, value] of Object.entries(sample.ex).slice(0, 4)) {
          const rounded = roundPercent(value);
          if (rounded !== null) ex[String(name).slice(0, 40)] = rounded;
        }
        if (Object.keys(ex).length) point.ex = ex;
      }
      return point;
    })
    .filter((point) => point.t !== null);
}

function sanitizeHistory(state, provider) {
  const day = sanitizeHistorySeries(state?.usageHistory?.[provider], MOBILE_HISTORY_DAY_POINTS);
  const week = sanitizeHistorySeries(state?.usageHistoryWeek?.[provider], MOBILE_HISTORY_WEEK_POINTS);
  return day.length || week.length ? { day, week } : null;
}

const STATUS_LEVELS = ['none', 'maintenance', 'minor', 'major', 'critical'];

// 官方状态页摘要：只带等级、相关组件和未解决事件的标题，不带链接以外的任何字段。
function sanitizeServiceStatus(slice) {
  const data = slice?.data;
  if (!data || typeof data !== 'object') return null;
  const level = (value) => (STATUS_LEVELS.includes(value) ? value : 'none');
  return {
    level: level(data.level),
    fetchedAt: safeNumber(slice.fetchedAt),
    home: typeof data.home === 'string' && /^https:\/\//.test(data.home) ? data.home : null,
    components: Array.isArray(data.components)
      ? data.components.slice(0, 6).map((component) => ({ name: String(component?.name || '').slice(0, 60), level: level(component?.level) }))
      : [],
    incidents: Array.isArray(data.incidents)
      ? data.incidents.slice(0, 3).map((incident) => ({
          name: String(incident?.name || '').slice(0, 160),
          impact: level(incident?.impact),
          updatedAt: safeNumber(incident?.updatedAt)
        }))
      : []
  };
}

function createMobilePayload(state) {
  const providers = {};
  const enabled = Array.isArray(state?.enabledProviders) ? state.enabledProviders : ['codex'];

  if (enabled.includes('codex')) {
    providers.codex = {
      label: 'GPT',
      usage: sanitizeUsageSlice(state.usage),
      activity: sanitizeActivitySlice(state.tokenActivity),
      radar: sanitizeRadarSlice(state.radar, 'codex'),
      history: sanitizeHistory(state, 'codex'),
      serviceStatus: sanitizeServiceStatus(state.codexStatus)
    };
  }
  if (enabled.includes('claude')) {
    providers.claude = {
      label: 'Claude',
      usage: sanitizeUsageSlice(state.claudeUsage),
      activity: sanitizeActivitySlice(state.claudeActivity),
      radar: sanitizeRadarSlice(state.claudeRadar, 'claude'),
      history: sanitizeHistory(state, 'claude'),
      serviceStatus: sanitizeServiceStatus(state.claudeStatus)
    };
  }
  for (const provider of ['kimi', 'glm', 'qwen']) {
    if (!enabled.includes(provider)) continue;
    providers[provider] = {
      label: provider === 'kimi' ? 'Kimi' : provider === 'glm' ? 'GLM' : 'Qwen',
      usage: sanitizeUsageSlice(state[`${provider}Usage`]),
      activity: null,
      radar: null
    };
  }

  return {
    version: 1,
    serverTime: Date.now(),
    language: String(state?.language || 'zh-CN'),
    providers
  };
}

function tokenMatches(actual, expected) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function extractCookie(request, name) {
  const raw = String(request.headers.cookie || '');
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

// 接口只认请求头和 Cookie，不认 URL 里的 ?token=：地址会留在浏览器历史、代理和 Tailscale Serve 的日志里。
// URL 里的密钥只用于首次打开页面和安装清单（见 serveStatic 和 manifest 分支），页面随后用它换 Cookie。
function extractToken(request) {
  const authorization = request.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return bearer
    || extractCookie(request, MOBILE_COOKIE_NAME)
    || '';
}

// 经反向代理（Tailscale Serve 等）转来的请求会带这些头；「仅本机」时拒绝。
function isProxiedRequest(request) {
  const headers = request.headers || {};
  return Boolean(headers['x-forwarded-for'] || headers['x-forwarded-host'] || headers['tailscale-user-login']);
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': CONTENT_TYPES['.json'],
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

function createMobileManifest(accessToken = '') {
  const startUrl = accessToken
    ? `/mobile/?token=${encodeURIComponent(accessToken)}`
    : '/mobile/';
  return {
    name: 'Codex Menu Meter Mobile',
    short_name: 'AI 用量',
    description: 'Secure mobile view for GPT and Claude usage.',
    id: '/mobile/',
    start_url: startUrl,
    scope: '/mobile/',
    display: 'standalone',
    background_color: '#f2f2f7',
    theme_color: '#f2f2f7',
    icons: [
      { src: '/mobile/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/mobile/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  };
}

function createMobileServer({
  assetsDir,
  getAccessToken,
  getState,
  onRefresh,
  host = '127.0.0.1',
  port = 43821,
  rejectProxied = false
}) {
  let server = null;
  let address = null;
  let heartbeatTimer = null;
  const eventClients = new Set();
  let lastRefreshAt = 0;

  async function serveStatic(url, response) {
    const requestPath = url.pathname;
    const fileName = STATIC_FILES.get(requestPath);
    if (!fileName) return false;
    const filePath = path.join(assetsDir, fileName);
    const extension = path.extname(fileName);
    try {
      let body = await fs.readFile(filePath);
      if (fileName === 'index.html') {
        const token = url.searchParams.get('token') || '';
        if (tokenMatches(token, getAccessToken())) {
          const manifestUrl = `./manifest.webmanifest?token=${encodeURIComponent(token)}`;
          body = Buffer.from(String(body).replace('./manifest.webmanifest', manifestUrl));
        }
      }
      response.writeHead(200, {
        'Cache-Control': ['.html', '.css', '.js', '.webmanifest'].includes(extension)
          ? 'no-cache'
          : 'public, max-age=3600',
        'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        'Content-Type': CONTENT_TYPES[extension] || 'application/octet-stream',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      });
      response.end(body);
    } catch {
      sendJson(response, 404, { error: 'not_found' });
    }
    return true;
  }

  async function handleRequest(request, response) {
    const url = new URL(request.url || '/', `http://${host}`);
    if (rejectProxied && isProxiedRequest(request)) {
      sendJson(response, 403, { error: 'local_only' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(302, { Location: '/mobile/' });
      response.end();
      return;
    }
    if (request.method === 'GET' && url.pathname === '/mobile/manifest.webmanifest' && url.searchParams.has('token')) {
      const token = url.searchParams.get('token') || '';
      if (!tokenMatches(token, getAccessToken())) {
        sendJson(response, 401, { error: 'unauthorized' });
        return;
      }
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': CONTENT_TYPES['.webmanifest'],
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(JSON.stringify(createMobileManifest(token)));
      return;
    }
    if (request.method === 'GET' && await serveStatic(url, response)) return;
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, service: 'Codex Menu Meter Mobile' });
      return;
    }

    if (!tokenMatches(extractToken(request), getAccessToken())) {
      sendJson(response, 401, { error: 'unauthorized' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/session') {
      const token = getAccessToken();
      const forwardedProto = String(request.headers['x-forwarded-proto'] || '').toLowerCase();
      const secure = Boolean(request.socket.encrypted) || forwardedProto === 'https';
      const attributes = [
        `${MOBILE_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'HttpOnly',
        'SameSite=Strict',
        'Path=/',
        'Max-Age=31536000'
      ];
      if (secure) attributes.push('Secure');
      response.writeHead(204, {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Set-Cookie': attributes.join('; '),
        'X-Content-Type-Options': 'nosniff'
      });
      response.end();
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/state') {
      sendJson(response, 200, createMobilePayload(getState()));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no'
      });
      response.write(`event: state\ndata: ${JSON.stringify(createMobilePayload(getState()))}\n\n`);
      eventClients.add(response);
      request.on('close', () => eventClients.delete(response));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/refresh') {
      const now = Date.now();
      if (now - lastRefreshAt < 10_000) {
        sendJson(response, 429, { error: 'rate_limited' });
        return;
      }
      lastRefreshAt = now;
      sendJson(response, 202, { ok: true });
      Promise.resolve(onRefresh()).catch(() => {});
      return;
    }
    sendJson(response, 404, { error: 'not_found' });
  }

  return {
    async start() {
      if (server) return address;
      server = http.createServer((request, response) => {
        handleRequest(request, response).catch(() => {
          if (!response.headersSent) sendJson(response, 500, { error: 'internal_error' });
          else response.end();
        });
      });
      server.keepAliveTimeout = 65_000;
      address = await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(server.address()));
      });
      heartbeatTimer = setInterval(() => {
        for (const response of eventClients) {
          try {
            response.write(': keepalive\n\n');
          } catch {
            eventClients.delete(response);
          }
        }
      }, 25_000);
      heartbeatTimer.unref?.();
      return address;
    },
    async stop() {
      if (!server) return;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      for (const response of eventClients) response.end();
      eventClients.clear();
      await new Promise((resolve) => server.close(resolve));
      server = null;
      address = null;
    },
    broadcast(state) {
      if (!server || !eventClients.size) return;
      const message = `event: state\ndata: ${JSON.stringify(createMobilePayload(state))}\n\n`;
      for (const response of eventClients) {
        try {
          response.write(message);
        } catch {
          eventClients.delete(response);
        }
      }
    },
    disconnectClients() {
      for (const response of eventClients) response.end();
      eventClients.clear();
    },
    getAddress() {
      return address;
    }
  };
}

// 云端上传去重用的内容签名：去掉每次都会变的时间戳和"刷新中"这类瞬时状态，
// 只有用户能看到的数字或状态变了才重新加密上传。
const TRANSIENT_SLICE_STATUSES = new Set(['refreshing', 'loading']);

function mobilePayloadSignature(payload) {
  return JSON.stringify(payload, (key, value) => {
    // 历史每次刷新都会多一个点；数字没变时靠心跳顺带更新，不单独触发上传。
    if (key === 'serverTime' || key === 'fetchedAt' || key === 'generatedAt' || key === 'sync' || key === 'history') return undefined;
    if (key === 'status' && TRANSIENT_SLICE_STATUSES.has(value)) return 'ok';
    return value;
  });
}

module.exports = {
  createAccessToken,
  createMobileManifest,
  createMobilePayload,
  mobilePayloadSignature,
  createMobileServer,
  findPreferredLanAddress
};
