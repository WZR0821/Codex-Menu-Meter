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
  ['/mobile/mobile.css', 'mobile.css'],
  ['/mobile/mobile.js', 'mobile.js'],
  ['/mobile/manifest.webmanifest', 'manifest.webmanifest'],
  ['/mobile/icon.svg', 'icon.svg']
]);

function createAccessToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
    fetchedAt: safeNumber(slice?.fetchedAt),
    data: data ? {
      fiveHourUnlimited: Boolean(data.fiveHourUnlimited),
      planType: data.planType ? String(data.planType) : null,
      primaryWindow: sanitizeWindow(data.primaryWindow),
      secondaryWindow: sanitizeWindow(data.secondaryWindow),
      extraWindows: Array.isArray(data.extraWindows)
        ? data.extraWindows.map(sanitizeWindow).filter(Boolean)
        : []
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
      days: Array.isArray(data.days) ? data.days.slice(-30).map((day) => ({
        day: String(day.day || ''),
        value: safeNumber(day.value) || 0,
        tokens: safeNumber(day.tokens) || 0,
        ioTokens: safeNumber(day.ioTokens) || 0,
        threads: safeNumber(day.threads) || 0,
        costUsd: safeNumber(day.costUsd) || 0
      })) : []
    } : null
  };
}

function sanitizeIqItem(item) {
  return {
    label: String(item?.label || ''),
    modelLabel: String(item?.modelLabel || item?.label || ''),
    reasoningEffort: item?.reasoningEffort ? String(item.reasoningEffort) : null,
    score: safeNumber(item?.score),
    status: item?.status ? String(item.status) : 'unknown',
    passed: safeNumber(item?.passed),
    tasks: safeNumber(item?.tasks),
    costUsd: safeNumber(item?.costUsd),
    wallTimeHuman: item?.wallTimeHuman ? String(item.wallTimeHuman) : null,
    wallHours: safeNumber(item?.wallHours)
  };
}

function sanitizeRadarSlice(slice, provider) {
  const data = slice?.data;
  const base = {
    status: String(slice?.status || 'idle'),
    error: slice?.error ? String(slice.error) : null,
    fetchedAt: safeNumber(slice?.fetchedAt),
    data: null
  };
  if (!data) return base;

  if (provider === 'claude') {
    base.data = {
      sourceUrl: data.sourceUrl ? String(data.sourceUrl) : null,
      updatedAt: data.updatedAt ? String(data.updatedAt) : null,
      iqUpdatedAt: data.iqUpdatedAt ? String(data.iqUpdatedAt) : null,
      items: Array.isArray(data.items) ? data.items.slice(0, 12).map(sanitizeIqItem) : [],
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
      updatedAt: data.modelIq.updatedAt ? String(data.modelIq.updatedAt) : null,
      latestDate: data.modelIq.latestDate ? String(data.modelIq.latestDate) : null,
      items: Array.isArray(data.modelIq.items) ? data.modelIq.items.slice(0, 12).map(sanitizeIqItem) : []
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

function createMobilePayload(state) {
  const providers = {};
  const enabled = Array.isArray(state?.enabledProviders) ? state.enabledProviders : ['codex'];

  if (enabled.includes('codex')) {
    providers.codex = {
      label: 'GPT',
      usage: sanitizeUsageSlice(state.usage),
      activity: sanitizeActivitySlice(state.tokenActivity),
      radar: sanitizeRadarSlice(state.radar, 'codex')
    };
  }
  if (enabled.includes('claude')) {
    providers.claude = {
      label: 'Claude',
      usage: sanitizeUsageSlice(state.claudeUsage),
      activity: sanitizeActivitySlice(state.claudeActivity),
      radar: sanitizeRadarSlice(state.claudeRadar, 'claude')
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

function extractToken(request, url) {
  const authorization = request.headers.authorization || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  return url.searchParams.get('token') || '';
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

function createMobileServer({
  assetsDir,
  getAccessToken,
  getState,
  onRefresh,
  host = '127.0.0.1',
  port = 43821
}) {
  let server = null;
  let address = null;
  let heartbeatTimer = null;
  const eventClients = new Set();
  let lastRefreshAt = 0;

  async function serveStatic(requestPath, response) {
    const fileName = STATIC_FILES.get(requestPath);
    if (!fileName) return false;
    const filePath = path.join(assetsDir, fileName);
    const extension = path.extname(fileName);
    try {
      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=3600',
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
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(302, { Location: '/mobile/' });
      response.end();
      return;
    }
    if (request.method === 'GET' && await serveStatic(url.pathname, response)) return;
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, service: 'Codex Menu Meter Mobile' });
      return;
    }

    if (!tokenMatches(extractToken(request, url), getAccessToken())) {
      sendJson(response, 401, { error: 'unauthorized' });
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

module.exports = {
  createAccessToken,
  createMobilePayload,
  createMobileServer
};
