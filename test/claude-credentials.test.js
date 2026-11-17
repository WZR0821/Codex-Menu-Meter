const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAccessTokenFresh,
  isRefreshTokenExpired,
  isCredentialUsable,
  mergeRefreshedOAuth
} = require('../src/claude-credentials');

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

test('访问令牌：没过期、或没有过期时间时算可用', () => {
  assert.equal(isAccessTokenFresh({ accessToken: 'a', expiresAt: NOW + HOUR }, NOW), true);
  assert.equal(isAccessTokenFresh({ accessToken: 'a' }, NOW), true);
  assert.equal(isAccessTokenFresh({ accessToken: 'a', expiresAt: NOW + 30_000 }, NOW), false);
  assert.equal(isAccessTokenFresh({ accessToken: 'a', expiresAt: NOW - HOUR }, NOW), false);
  assert.equal(isAccessTokenFresh({ expiresAt: NOW + HOUR }, NOW), false);
});

test('刷新令牌：只有明确过期才算过期，字段缺失按未知处理', () => {
  assert.equal(isRefreshTokenExpired({ refreshToken: 'r', refreshTokenExpiresAt: NOW - 1 }, NOW), true);
  assert.equal(isRefreshTokenExpired({ refreshToken: 'r', refreshTokenExpiresAt: NOW + HOUR }, NOW), false);
  assert.equal(isRefreshTokenExpired({ refreshToken: 'r' }, NOW), false);
  assert.equal(isRefreshTokenExpired({ refreshToken: 'r', refreshTokenExpiresAt: String(NOW - 1) }, NOW), true);
  assert.equal(isRefreshTokenExpired({}, NOW), true);
});

test('两个令牌都过期的凭据不可用（本机 2026-09 起断连的情况）', () => {
  const stale = {
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: NOW - 60 * 24 * HOUR,
    refreshTokenExpiresAt: NOW - 60 * 24 * HOUR
  };
  assert.equal(isCredentialUsable(stale, NOW), false);
  assert.equal(isCredentialUsable({ ...stale, refreshTokenExpiresAt: NOW + HOUR }, NOW), true);
  assert.equal(isCredentialUsable({ ...stale, expiresAt: NOW + HOUR }, NOW), true);
  assert.equal(isCredentialUsable(null, NOW), false);
});

test('刷新后合并：令牌轮换且没给新过期时间时，丢弃旧的过期时间', () => {
  const raw = { accessToken: 'a', refreshToken: 'r1', refreshTokenExpiresAt: NOW - 1, subscriptionType: 'pro' };
  const rotated = mergeRefreshedOAuth(raw, { accessToken: 'b', refreshToken: 'r2', expiresAt: NOW + HOUR });
  assert.equal(rotated.refreshToken, 'r2');
  assert.equal('refreshTokenExpiresAt' in rotated, false);
  assert.equal(rotated.subscriptionType, 'pro');
  assert.equal(isRefreshTokenExpired(rotated, NOW), false);
});

test('刷新后合并：响应给了新过期时间就采用，未轮换则保留原值', () => {
  const raw = { accessToken: 'a', refreshToken: 'r1', refreshTokenExpiresAt: NOW + HOUR };
  const withExpiry = mergeRefreshedOAuth(raw, {
    accessToken: 'b', refreshToken: 'r2', refreshTokenExpiresAt: NOW + 30 * 24 * HOUR
  });
  assert.equal(withExpiry.refreshTokenExpiresAt, NOW + 30 * 24 * HOUR);
  const same = mergeRefreshedOAuth(raw, { accessToken: 'b', refreshToken: 'r1' });
  assert.equal(same.refreshTokenExpiresAt, NOW + HOUR);
});
