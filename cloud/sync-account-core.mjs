const RECORD_KEY = 'snapshot';
const MAX_BODY_BYTES = 1024 * 1024;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}

function bearerToken(request) {
  const authorization = String(request.headers.get('authorization') || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function accountIdFromRequest(request) {
  const match = new URL(request.url).pathname.match(/^\/v1\/snapshots\/([A-Za-z0-9_-]{20,64})$/);
  return match?.[1] || null;
}

function validEnvelope(value, accountId) {
  return Number(value?.version) === 1
    && value?.accountId === accountId
    && Number.isFinite(Number(value?.updatedAt))
    && Number(value.updatedAt) > 0
    && /^[A-Za-z0-9_-]{16}$/.test(String(value?.iv || ''))
    && /^[A-Za-z0-9_-]{24,1398102}$/.test(String(value?.ciphertext || ''));
}

export async function handleSyncAccountRequest(request, storage, now = Date.now()) {
  const accountId = accountIdFromRequest(request);
  if (!accountId) return jsonResponse(404, { error: 'not_found' });

  const token = bearerToken(request);
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) {
    return jsonResponse(401, { error: 'unauthorized' });
  }
  const authHash = await sha256(token);
  const record = await storage.get(RECORD_KEY);

  if (request.method === 'PUT') {
    if (record && !constantTimeEqual(record.authHash, authHash)) {
      return jsonResponse(401, { error: 'unauthorized' });
    }
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: 'payload_too_large' });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: 'payload_too_large' });
    }
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return jsonResponse(400, { error: 'invalid_json' });
    }
    if (!validEnvelope(envelope, accountId)) {
      return jsonResponse(400, { error: 'invalid_envelope' });
    }
    if (record && Number(envelope.updatedAt) < Number(record.envelope?.updatedAt || 0)) {
      return jsonResponse(409, { error: 'stale_snapshot' });
    }
    await storage.put(RECORD_KEY, {
      authHash,
      envelope,
      receivedAt: Number(now)
    });
    await storage.setAlarm(Number(now) + RETENTION_MS);
    return jsonResponse(200, {
      ok: true,
      updatedAt: Number(envelope.updatedAt),
      receivedAt: Number(now)
    });
  }

  if (!record) return jsonResponse(404, { error: 'snapshot_not_found' });
  if (!constantTimeEqual(record.authHash, authHash)) {
    return jsonResponse(401, { error: 'unauthorized' });
  }

  if (request.method === 'GET') {
    const etag = `"${await sha256(record.envelope.ciphertext)}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: { 'Cache-Control': 'no-store', ETag: etag }
      });
    }
    return jsonResponse(200, record.envelope, { ETag: etag });
  }

  if (request.method === 'DELETE') {
    await storage.deleteAll();
    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'method_not_allowed' }, { Allow: 'GET, PUT, DELETE' });
}

export async function expireSyncAccount(storage) {
  await storage.deleteAll();
}
