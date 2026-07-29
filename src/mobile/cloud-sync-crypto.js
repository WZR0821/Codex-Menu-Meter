(function initCloudSyncCrypto(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CMM_SYNC_CRYPTO = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCloudSyncCrypto(root) {
  const VERSION = 1;
  const ACCOUNT_ID_BYTES = 18;
  const SECRET_BYTES = 32;
  const ENCRYPTION_INFO = 'cmm-sync-encryption-v1';
  const AUTH_INFO = 'cmm-sync-auth-v1';

  function webCrypto() {
    if (root?.crypto?.subtle) return root.crypto;
    if (typeof require === 'function') return require('crypto').webcrypto;
    throw new Error('webcrypto_unavailable');
  }

  function utf8(value) {
    return new TextEncoder().encode(String(value));
  }

  function base64UrlEncode(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64url');
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }

  function base64UrlDecode(value) {
    const input = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
    const padded = input + '='.repeat((4 - (input.length % 4 || 4)) % 4);
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(padded, 'base64'));
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function randomBase64Url(byteLength) {
    const bytes = new Uint8Array(byteLength);
    webCrypto().getRandomValues(bytes);
    return base64UrlEncode(bytes);
  }

  function validateCredentials(credentials) {
    const accountId = String(credentials?.accountId || '').trim();
    const secret = String(credentials?.secret || '').trim();
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(accountId)) throw new Error('invalid_account_id');
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(secret)) throw new Error('invalid_sync_secret');
    if (base64UrlDecode(secret).byteLength !== SECRET_BYTES) throw new Error('invalid_sync_secret');
    return { accountId, secret };
  }

  function createCredentials() {
    return {
      version: VERSION,
      accountId: randomBase64Url(ACCOUNT_ID_BYTES),
      secret: randomBase64Url(SECRET_BYTES)
    };
  }

  async function deriveMaterial(credentials) {
    const normalized = validateCredentials(credentials);
    const crypto = webCrypto();
    const material = await crypto.subtle.importKey(
      'raw',
      base64UrlDecode(normalized.secret),
      'HKDF',
      false,
      ['deriveBits']
    );
    const salt = utf8(normalized.accountId);
    const derive = (info) => crypto.subtle.deriveBits({
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: utf8(info)
    }, material, 256);
    const [encryptionBits, authBits] = await Promise.all([
      derive(ENCRYPTION_INFO),
      derive(AUTH_INFO)
    ]);
    const encryptionKey = await crypto.subtle.importKey(
      'raw',
      encryptionBits,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    return {
      accountId: normalized.accountId,
      encryptionKey,
      authToken: base64UrlEncode(authBits)
    };
  }

  function envelopeAad(accountId, timestamp) {
    return utf8(`cmm-sync-v1:${accountId}:${timestamp}`);
  }

  async function encryptPayload(payload, credentials, timestamp = Date.now()) {
    const crypto = webCrypto();
    const material = await deriveMaterial(credentials);
    const updatedAt = Number(timestamp);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) throw new Error('invalid_timestamp');
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const plaintext = utf8(JSON.stringify(payload));
    const encrypted = await crypto.subtle.encrypt({
      name: 'AES-GCM',
      iv,
      additionalData: envelopeAad(material.accountId, updatedAt),
      tagLength: 128
    }, material.encryptionKey, plaintext);
    return {
      version: VERSION,
      accountId: material.accountId,
      updatedAt,
      iv: base64UrlEncode(iv),
      ciphertext: base64UrlEncode(encrypted)
    };
  }

  async function decryptPayload(envelope, credentials) {
    const normalized = validateCredentials(credentials);
    if (Number(envelope?.version) !== VERSION) throw new Error('unsupported_envelope');
    if (String(envelope?.accountId || '') !== normalized.accountId) throw new Error('account_mismatch');
    const updatedAt = Number(envelope.updatedAt);
    const iv = base64UrlDecode(envelope.iv);
    const ciphertext = base64UrlDecode(envelope.ciphertext);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0 || iv.byteLength !== 12 || ciphertext.byteLength < 17) {
      throw new Error('invalid_envelope');
    }
    const crypto = webCrypto();
    const material = await deriveMaterial(normalized);
    try {
      const decrypted = await crypto.subtle.decrypt({
        name: 'AES-GCM',
        iv,
        additionalData: envelopeAad(material.accountId, updatedAt),
        tagLength: 128
      }, material.encryptionKey, ciphertext);
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch {
      throw new Error('decrypt_failed');
    }
  }

  function createPairingCode(credentials) {
    const normalized = validateCredentials(credentials);
    return base64UrlEncode(utf8(JSON.stringify({
      version: VERSION,
      accountId: normalized.accountId,
      secret: normalized.secret
    })));
  }

  function createRecoveryCode(credentials) {
    const normalized = validateCredentials(credentials);
    return `${normalized.accountId}.${normalized.secret}`;
  }

  function parsePairingCode(value) {
    const input = String(value || '').trim();
    if (input.includes('.')) {
      const [accountId, secret, ...rest] = input.split('.');
      if (!rest.length) return validateCredentials({ accountId, secret });
    }
    try {
      const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(input)));
      if (Number(parsed?.version) !== VERSION) throw new Error('unsupported_pairing_code');
      return validateCredentials(parsed);
    } catch (error) {
      if (error.message === 'unsupported_pairing_code') throw error;
      throw new Error('invalid_pairing_code');
    }
  }

  function normalizeServerUrl(value) {
    let url;
    try {
      url = new URL(String(value || '').trim());
    } catch {
      throw new Error('invalid_server_url');
    }
    const localHttp = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) throw new Error('insecure_server_url');
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  }

  function createPairingUrl(serverUrl, credentials) {
    const base = normalizeServerUrl(serverUrl);
    return `${base}/mobile/#pair=${encodeURIComponent(createPairingCode(credentials))}`;
  }

  return {
    VERSION,
    createCredentials,
    createPairingCode,
    createPairingUrl,
    createRecoveryCode,
    decryptPayload,
    deriveMaterial,
    encryptPayload,
    normalizeServerUrl,
    parsePairingCode,
    validateCredentials
  };
});
