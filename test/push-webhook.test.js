const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWebhookUrl, buildWebhookRequest } = require('../src/push-webhook.js');

test('bark urls post to /push with the device key in the body', () => {
  const request = buildWebhookRequest('https://api.day.app/abc123/', '标题', '正文');
  assert.equal(request.kind, 'bark');
  assert.equal(request.url, 'https://api.day.app/push');
  assert.deepEqual(JSON.parse(request.body), { device_key: 'abc123', title: '标题', body: '正文', group: 'Codex Menu Meter' });
});

test('ntfy topics publish as JSON to the server root', () => {
  const request = buildWebhookRequest('https://ntfy.sh/my-topic', 'T', 'B');
  assert.equal(request.kind, 'ntfy');
  assert.equal(request.url, 'https://ntfy.sh/');
  assert.deepEqual(JSON.parse(request.body), { topic: 'my-topic', title: 'T', message: 'B' });
});

test('other urls get a generic JSON body', () => {
  const request = buildWebhookRequest('https://example.com/hook?x=1', 'T', 'B', new Date('2026-11-13T00:00:00Z'));
  assert.equal(request.kind, 'json');
  assert.equal(request.url, 'https://example.com/hook?x=1');
  assert.deepEqual(JSON.parse(request.body), { title: 'T', body: 'B', source: 'codex-menu-meter', at: '2026-11-13T00:00:00.000Z' });
});

test('normalizeWebhookUrl keeps http(s) only', () => {
  assert.equal(normalizeWebhookUrl(' https://ntfy.sh/a '), 'https://ntfy.sh/a');
  assert.equal(normalizeWebhookUrl('javascript:alert(1)'), '');
  assert.equal(normalizeWebhookUrl('not a url'), '');
  assert.equal(normalizeWebhookUrl(undefined), '');
});
