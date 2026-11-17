const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  createMobileManifest,
  createMobilePayload,
  createMobileServer,
  findPreferredLanAddress,
  mobilePayloadSignature
} = require('../src/mobile-server');

function sampleState() {
  return {
    language: 'zh-CN',
    enabledProviders: ['codex', 'claude'],
    usage: {
      status: 'ok',
      fetchedAt: 1234,
      data: {
        primaryWindow: { remainingPercent: 61, resetAt: 5000 },
        secondaryWindow: { remainingPercent: 72, resetAt: 9000 },
        accessToken: 'must-not-leak',
        resetCredits: {
          availableCount: 1,
          credits: [{ status: 'available', title: 'Reset credit', expiresAt: 10_000, secret: 'hidden' }]
        }
      }
    },
    tokenActivity: {
      status: 'ok',
      data: {
        source: 'codex_local',
        units: 'tokens',
        windowDays: 30,
        windows: {
          fiveHour: {
            startAt: 1000,
            endAt: 2000,
            basis: 'cycle',
            tokens: 60,
            ioTokens: 20,
            inputTokens: 50,
            cachedInputTokens: 40,
            threads: 1
          },
          week: {
            startAt: 500,
            endAt: 2000,
            basis: 'cycle',
            tokens: 120,
            ioTokens: 80,
            inputTokens: 100,
            cachedInputTokens: 40,
            threads: 2
          }
        },
        days: [{
          day: '2026-07-23',
          tokens: 120,
          ioTokens: 80,
          inputTokens: 100,
          cachedInputTokens: 40,
          threads: 2,
          costUsd: 0.12
        }]
      }
    },
    radar: {
      status: 'ok',
      data: {
        sourceUrl: 'https://codexradar.com/',
        modelIq: {
          updatedAt: '2026-07-23T10:00:00Z',
          items: [{ label: 'GPT-5.6', score: 101, status: 'green' }]
        },
        quotaRadar: { rows: [{ tier: 'Plus', five_h: 12, seven_d: 30 }] }
      }
    },
    claudeUsage: { status: 'idle', data: null },
    claudeActivity: { status: 'idle', data: null },
    claudeRadar: { status: 'idle', data: null }
  };
}

test('mobile payload includes display data and excludes credential-shaped fields', () => {
  const payload = createMobilePayload(sampleState());
  assert.equal(payload.providers.codex.usage.data.primaryWindow.remainingPercent, 61);
  assert.equal(payload.providers.codex.activity.data.days[0].threads, 2);
  assert.equal(payload.providers.codex.activity.data.days[0].cachedInputTokens, 40);
  assert.equal(payload.providers.codex.activity.data.windows.fiveHour.tokens, 60);
  assert.equal(payload.providers.codex.radar.data.modelIq.items[0].score, 101);
  assert.equal(payload.providers.codex.usage.data.resetCredits.credits[0].title, 'Reset credit');
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('must-not-leak'), false);
  assert.equal(serialized.includes('hidden'), false);
});

test('mobile payload keeps reset credit details from both providers', () => {
  const state = sampleState();
  // Codex 的到期时间是 ISO 字符串，Claude 的是毫秒数；手机端两种都要拿到。
  state.usage.data.resetCredits.credits[0].expiresAt = '2026-12-01T22:15:13.264738Z';
  state.claudeUsage = {
    status: 'ok',
    data: {
      primaryWindow: { remainingPercent: 70, resetAt: 5000 },
      secondaryWindow: { remainingPercent: 96, resetAt: 9000 },
      resetCredits: {
        availableCount: 2,
        unavailableReason: null,
        credits: [{ status: 'pending', title: '', kind: 'session', resetsLeft: 2, resetsTotal: 3, expiresAt: 20_000, id: 'grant-id' }]
      }
    }
  };
  const payload = createMobilePayload(state);
  assert.equal(payload.providers.codex.usage.data.resetCredits.credits[0].expiresAt, Date.parse('2026-12-01T22:15:13.264738Z'));
  assert.deepEqual(payload.providers.claude.usage.data.resetCredits, {
    availableCount: 2,
    error: null,
    unavailableReason: null,
    credits: [{ status: 'pending', title: null, kind: 'session', resetsLeft: 2, resetsTotal: 3, expiresAt: 20_000 }]
  });

  state.claudeUsage.data.resetCredits = { availableCount: 0, credits: [], unavailableReason: 'surface', error: null };
  assert.equal(createMobilePayload(state).providers.claude.usage.data.resetCredits.unavailableReason, 'surface');
});

test('mobile payload carries compact history and the relevant status summary', () => {
  const state = sampleState();
  const day = Array.from({ length: 200 }, (_, index) => ({ t: 1_000 + index * 60_000, five: index / 3, week: 20.04, ex: { Fable: 41.26 } }));
  state.usageHistory = { codex: day };
  state.usageHistoryWeek = { codex: day.slice(0, 50) };
  state.codexStatus = {
    status: 'ok',
    fetchedAt: 99,
    data: {
      level: 'minor',
      home: 'https://status.openai.com/',
      components: [{ name: 'Codex', status: 'degraded_performance', level: 'minor' }],
      incidents: [{ name: 'Elevated errors', impact: 'minor', status: 'investigating', updatedAt: 50 }],
      pageDescription: 'not forwarded'
    }
  };
  const payload = createMobilePayload(state);
  const history = payload.providers.codex.history;
  assert.ok(history.day.length <= 96);
  assert.equal(history.day.at(-1).t, day.at(-1).t);
  assert.equal(history.day[0].week, 20);
  assert.deepEqual(history.day[0].ex, { Fable: 41.3 });
  assert.equal(history.week.length, 50);
  assert.equal(payload.providers.codex.serviceStatus.level, 'minor');
  assert.equal(payload.providers.codex.serviceStatus.components[0].name, 'Codex');
  assert.equal(JSON.stringify(payload).includes('not forwarded'), false);
  assert.equal(payload.providers.claude.history, null);
});

test('payload signature ignores timestamps and transient refreshing state', () => {
  const state = sampleState();
  const first = createMobilePayload(state);
  state.usage = { ...state.usage, status: 'refreshing', fetchedAt: 9_999 };
  state.usageHistory = { codex: [{ t: 5, five: 1, week: 2 }] };
  const second = createMobilePayload(state);
  second.sync = { generatedAt: 123 };
  assert.equal(mobilePayloadSignature(first), mobilePayloadSignature(second));
  state.usage = { ...state.usage, data: { ...state.usage.data, primaryWindow: { remainingPercent: 60, resetAt: 5000 } } };
  assert.notEqual(mobilePayloadSignature(first), mobilePayloadSignature(createMobilePayload(state)));
});

test('preferred LAN address favors Wi-Fi and ignores loopback and link-local interfaces', () => {
  const address = findPreferredLanAddress({
    lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    en7: [{ address: '169.254.8.253', family: 'IPv4', internal: false }],
    utun3: [{ address: '100.84.2.5', family: 'IPv4', internal: false }],
    en0: [{ address: '192.168.0.23', family: 'IPv4', internal: false }]
  });
  assert.equal(address, '192.168.0.23');
});

test('mobile manifest keeps the access token in the installed start URL', () => {
  const manifest = createMobileManifest('install-token');
  assert.equal(manifest.id, '/mobile/');
  assert.equal(manifest.start_url, '/mobile/?token=install-token');
});

test('mobile server requires the access token for state data', async (context) => {
  const token = 'test-token-12345678901234567890';
  const server = createMobileServer({
    assetsDir: path.join(__dirname, '..', 'src', 'mobile'),
    getAccessToken: () => token,
    getState: sampleState,
    onRefresh: () => {},
    port: 0
  });
  context.after(() => server.stop());
  const address = await server.start();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);

  const unauthorized = await fetch(`${baseUrl}/api/state`);
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(`${baseUrl}/api/state`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(authorized.status, 200);
  const body = await authorized.json();
  assert.equal(body.providers.codex.label, 'GPT');

  const page = await fetch(`${baseUrl}/mobile/`);
  assert.equal(page.status, 200);
  const pageText = await page.text();
  assert.match(pageText, /AI 用量/);
  // 节奏模块和桌面面板共用，手机页面要能单独加载到它（放在 mobile.js 之前）。
  assert.ok(pageText.indexOf('./usage-pace.js') > 0 && pageText.indexOf('./usage-pace.js') < pageText.indexOf('./mobile.js'));
  const paceScript = await fetch(`${baseUrl}/mobile/usage-pace.js`);
  assert.equal(paceScript.status, 200);
  assert.match(paceScript.headers.get('content-type'), /javascript/);
  assert.match(await paceScript.text(), /CMM_PACE/);

  const installPage = await fetch(`${baseUrl}/mobile/?token=${token}`);
  assert.match(await installPage.text(), /manifest\.webmanifest\?token=/);

  const manifest = await fetch(`${baseUrl}/mobile/manifest.webmanifest?token=${token}`);
  assert.equal(manifest.status, 200);
  assert.equal((await manifest.json()).start_url, `/mobile/?token=${token}`);

  const session = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(session.status, 204);
  const cookie = session.headers.get('set-cookie');
  assert.match(cookie, /cmm_mobile_token=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);

  const cookieAuthorized = await fetch(`${baseUrl}/api/state`, {
    headers: { Cookie: cookie.split(';')[0] }
  });
  assert.equal(cookieAuthorized.status, 200);
});

test('disconnecting clients revokes an existing event stream', async (context) => {
  const token = 'event-token-12345678901234567890';
  const server = createMobileServer({
    assetsDir: path.join(__dirname, '..', 'src', 'mobile'),
    getAccessToken: () => token,
    getState: sampleState,
    onRefresh: () => {},
    port: 0
  });
  context.after(() => server.stop());
  const address = await server.start();
  // 事件流不接受 URL 里的密钥，只认 Cookie / 请求头。
  const viaQuery = await fetch(`http://127.0.0.1:${address.port}/api/events?token=${token}`);
  assert.equal(viaQuery.status, 401);
  const response = await fetch(`http://127.0.0.1:${address.port}/api/events`, {
    headers: { Cookie: `cmm_mobile_token=${token}` }
  });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  await reader.read();
  server.disconnectClients();
  const closed = await reader.read();
  assert.equal(closed.done, true);
});

test('local-only scope rejects requests forwarded by a proxy', async (context) => {
  const token = 'local-token-123456789012345678901';
  const server = createMobileServer({
    assetsDir: path.join(__dirname, '..', 'src', 'mobile'),
    getAccessToken: () => token,
    getState: sampleState,
    onRefresh: () => {},
    port: 0,
    rejectProxied: true
  });
  context.after(() => server.stop());
  const address = await server.start();
  const base = `http://127.0.0.1:${address.port}`;
  const direct = await fetch(`${base}/api/state`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(direct.status, 200);
  const proxied = await fetch(`${base}/api/state`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '100.101.102.103' }
  });
  assert.equal(proxied.status, 403);
});
