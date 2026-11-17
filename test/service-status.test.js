const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStatusSummary } = require('../src/service-status.js');

test('ignores unrelated degraded components on the Claude page', () => {
  const result = normalizeStatusSummary({
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [
      { name: 'claude.ai', status: 'degraded_performance' },
      { name: 'Claude API (api.anthropic.com)', status: 'operational' },
      { name: 'Claude Code', status: 'operational' },
      { name: 'Claude Cowork', status: 'degraded_performance' }
    ],
    incidents: [{ name: 'Elevated errors affecting the Microsoft 365 connector', impact: 'major', status: 'identified', components: [{ name: 'claude.ai' }] }]
  }, 'claude');
  assert.equal(result.level, 'none');
  assert.deepEqual(result.components.map((item) => item.name), ['Claude API (api.anthropic.com)', 'Claude Code']);
  assert.equal(result.incidents.length, 0);
  assert.equal(result.pageIndicator, 'minor');
});

test('reports the worst relevant component and matching incidents', () => {
  const result = normalizeStatusSummary({
    status: { indicator: 'major' },
    components: [
      { name: 'Codex in ChatGPT Desktop', status: 'partial_outage' },
      { name: 'Responses', status: 'degraded_performance' },
      { name: 'Login', status: 'operational' },
      { name: 'Login', status: 'operational' }
    ],
    incidents: [
      { name: 'Codex tasks failing', impact: 'major', status: 'investigating', components: [] },
      { name: 'Image generation slow', impact: 'minor', status: 'investigating', components: [] }
    ]
  }, 'codex');
  assert.equal(result.level, 'major');
  assert.equal(result.components.length, 3);
  assert.deepEqual(result.incidents.map((item) => item.name), ['Codex tasks failing']);
});

test('rejects malformed payloads', () => {
  assert.equal(normalizeStatusSummary(null, 'claude'), null);
  assert.equal(normalizeStatusSummary({ components: 'x' }, 'codex'), null);
  assert.equal(normalizeStatusSummary({ components: [] }, 'kimi'), null);
});
