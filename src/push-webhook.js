// 手机推送的请求格式：Bark（api.day.app）、ntfy（ntfy.sh 或 ntfy.* 自建）各按自己的 JSON 接口发，
// 其他地址收到通用 JSON。只带提醒的标题和正文，不带用量明细或任何凭据。

function normalizeWebhookUrl(value) {
  const text = typeof value === 'string' ? value.trim().slice(0, 2048) : '';
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function buildWebhookRequest(rawUrl, title, body, now = new Date()) {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  if (host === 'api.day.app' && segments[0]) {
    return {
      kind: 'bark',
      url: `${url.origin}/push`,
      body: JSON.stringify({ device_key: decodeURIComponent(segments[0]), title, body, group: 'Codex Menu Meter' })
    };
  }
  if ((host === 'ntfy.sh' || host.startsWith('ntfy.')) && segments.length === 1) {
    return {
      kind: 'ntfy',
      url: `${url.origin}/`,
      body: JSON.stringify({ topic: decodeURIComponent(segments[0]), title, message: body })
    };
  }
  return {
    kind: 'json',
    url: url.toString(),
    body: JSON.stringify({ title, body, source: 'codex-menu-meter', at: now.toISOString() })
  };
}

module.exports = { normalizeWebhookUrl, buildWebhookRequest };
