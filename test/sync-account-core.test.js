const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCredentials,
  deriveMaterial,
  encryptPayload
} = require('../src/mobile/cloud-sync-crypto');

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.alarm = null;
  }

  get(key) {
    return this.values.get(key);
  }

  put(key, value) {
    this.values.set(key, value);
  }

  setAlarm(value) {
    this.alarm = value;
  }

  deleteAll() {
    this.values.clear();
  }
}

async function setup() {
  const { handleSyncAccountRequest } = await import('../cloud/sync-account-core.mjs');
  const credentials = createCredentials();
  const material = await deriveMaterial(credentials);
  const storage = new MemoryStorage();
  const url = `https://sync.example.test/v1/snapshots/${credentials.accountId}`;
  const headers = {
    Authorization: `Bearer ${material.authToken}`,
    'Content-Type': 'application/json'
  };
  return { credentials, handleSyncAccountRequest, headers, storage, url };
}

test('binds a new encrypted account to its derived authentication token', async () => {
  const context = await setup();
  const envelope = await encryptPayload({ providers: { codex: {} } }, context.credentials, 1000);
  const put = await context.handleSyncAccountRequest(new Request(context.url, {
    method: 'PUT',
    headers: context.headers,
    body: JSON.stringify(envelope)
  }), context.storage, 2000);
  assert.equal(put.status, 200);
  assert.ok(context.storage.alarm > 2000);

  const get = await context.handleSyncAccountRequest(new Request(context.url, {
    headers: context.headers
  }), context.storage, 3000);
  assert.equal(get.status, 200);
  assert.deepEqual(await get.json(), envelope);
});

test('rejects another authentication token and older snapshots', async () => {
  const context = await setup();
  const first = await encryptPayload({ value: 2 }, context.credentials, 2000);
  await context.handleSyncAccountRequest(new Request(context.url, {
    method: 'PUT', headers: context.headers, body: JSON.stringify(first)
  }), context.storage, 2500);

  const unauthorized = await context.handleSyncAccountRequest(new Request(context.url, {
    headers: { Authorization: `Bearer ${'x'.repeat(48)}` }
  }), context.storage, 3000);
  assert.equal(unauthorized.status, 401);

  const stale = await encryptPayload({ value: 1 }, context.credentials, 1000);
  const response = await context.handleSyncAccountRequest(new Request(context.url, {
    method: 'PUT', headers: context.headers, body: JSON.stringify(stale)
  }), context.storage, 3000);
  assert.equal(response.status, 409);
});

test('deletes a paired account with the valid authentication token', async () => {
  const context = await setup();
  const envelope = await encryptPayload({ value: 1 }, context.credentials, 1000);
  await context.handleSyncAccountRequest(new Request(context.url, {
    method: 'PUT', headers: context.headers, body: JSON.stringify(envelope)
  }), context.storage, 2000);

  const response = await context.handleSyncAccountRequest(new Request(context.url, {
    method: 'DELETE', headers: context.headers
  }), context.storage, 3000);
  assert.equal(response.status, 200);
  assert.equal(context.storage.values.size, 0);
});
