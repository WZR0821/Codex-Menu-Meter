import { DurableObject } from 'cloudflare:workers';
import { expireSyncAccount, handleSyncAccountRequest } from './sync-account-core.mjs';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

function withSecurityHeaders(response, cacheControl = null) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (cacheControl) headers.set('Cache-Control', cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function jsonResponse(status, body) {
  return withSecurityHeaders(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }), 'no-store');
}

export class SyncAccount extends DurableObject {
  async fetch(request) {
    return handleSyncAccountRequest(request, this.ctx.storage);
  }

  async alarm() {
    await expireSyncAccount(this.ctx.storage);
  }
}

async function serveMobileAsset(request, env, pathname) {
  const assetPath = pathname === '/mobile/' || pathname === '/mobile'
    ? '/'
    : pathname.slice('/mobile'.length);
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPath;
  assetUrl.search = '';
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
  const extension = assetPath === '/' ? 'html' : assetPath.split('.').pop();
  const noCache = ['html', 'css', 'js', 'webmanifest'].includes(extension);
  return withSecurityHeaders(assetResponse, noCache ? 'no-cache' : 'public, max-age=3600');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return Response.redirect(`${url.origin}/mobile/`, 302);
    }
    if (url.pathname === '/health') {
      return jsonResponse(200, { ok: true, service: 'Codex Menu Meter Encrypted Sync' });
    }
    if (url.pathname === '/mobile/runtime-config.js') {
      return withSecurityHeaders(new Response('window.CMM_MOBILE_MODE="cloud";\n', {
        headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
      }), 'no-store');
    }
    const accountMatch = url.pathname.match(/^\/v1\/snapshots\/([A-Za-z0-9_-]{20,64})$/);
    if (accountMatch) {
      const stub = env.SYNC_ACCOUNTS.getByName(accountMatch[1]);
      return stub.fetch(request);
    }
    if (url.pathname === '/mobile' || url.pathname.startsWith('/mobile/')) {
      return serveMobileAsset(request, env, url.pathname);
    }
    return jsonResponse(404, { error: 'not_found' });
  }
};
