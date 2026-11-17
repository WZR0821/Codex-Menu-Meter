const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCredentials,
  createPairingCode,
  createPairingUrl,
  createRecoveryCode,
  decryptPayload,
  deriveMaterial,
  encryptPayload,
  normalizeServerUrl,
  parsePairingCode
} = require('../src/mobile/cloud-sync-crypto');

test('encrypts and decrypts a mobile snapshot without exposing plaintext', async () => {
  const credentials = createCredentials();
  const payload = { version: 1, providers: { codex: { label: 'GPT', remaining: 81 } } };
  const envelope = await encryptPayload(payload, credentials, 1785300000000);

  assert.equal(envelope.accountId, credentials.accountId);
  assert.equal(JSON.stringify(envelope).includes('remaining'), false);
  assert.deepEqual(await decryptPayload(envelope, credentials), payload);
});

test('uses separate encryption and server authentication material', async () => {
  const credentials = createCredentials();
  const material = await deriveMaterial(credentials);

  assert.match(material.authToken, /^[A-Za-z0-9_-]{40,128}$/);
  assert.equal(material.encryptionKey.extractable, false);
  assert.notEqual(material.authToken, credentials.secret);
});

test('rejects decryption with another pairing secret', async () => {
  const credentials = createCredentials();
  const other = { ...createCredentials(), accountId: credentials.accountId };
  const envelope = await encryptPayload({ secret: 'not visible' }, credentials);

  await assert.rejects(() => decryptPayload(envelope, other), /decrypt_failed/);
});

test('round-trips QR pairing and recovery codes', () => {
  const credentials = createCredentials();
  assert.deepEqual(parsePairingCode(createPairingCode(credentials)), {
    accountId: credentials.accountId,
    secret: credentials.secret
  });
  assert.deepEqual(parsePairingCode(createRecoveryCode(credentials)), {
    accountId: credentials.accountId,
    secret: credentials.secret
  });
  assert.equal(
    createPairingUrl('https://sync.example.com/path?ignored=yes', credentials).startsWith('https://sync.example.com/mobile/#pair='),
    true
  );
});

test('requires HTTPS except for local development servers', () => {
  assert.equal(normalizeServerUrl('http://127.0.0.1:8787/path'), 'http://127.0.0.1:8787');
  assert.equal(normalizeServerUrl('https://sync.example.com/path'), 'https://sync.example.com');
  assert.throws(() => normalizeServerUrl('http://sync.example.com'), /insecure_server_url/);
});
