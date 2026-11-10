// Claude Code 登录凭据的纯判断逻辑：不读写钥匙串、不发请求，方便单测。
// 凭据形状来自 Claude CLI 写入钥匙串的 claudeAiOauth：
// { accessToken, refreshToken, expiresAt, refreshTokenExpiresAt, ... }

const ACCESS_TOKEN_MARGIN_MS = 60_000;

function timestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isAccessTokenFresh(oauth, now = Date.now()) {
  if (!oauth?.accessToken) return false;
  const expiresAt = timestamp(oauth.expiresAt);
  return !expiresAt || expiresAt - now >= ACCESS_TOKEN_MARGIN_MS;
}

// 只有明确知道刷新令牌的过期时间且已过期才算「过期」；
// 字段缺失时按未知处理，交给网络请求去判断。
function isRefreshTokenExpired(oauth, now = Date.now()) {
  if (!oauth?.refreshToken) return true;
  const expiresAt = timestamp(oauth.refreshTokenExpiresAt);
  return Boolean(expiresAt && expiresAt <= now);
}

// 这份凭据还能不能换来一次官方用量请求：访问令牌没过期，或者还能刷新。
function isCredentialUsable(oauth, now = Date.now()) {
  if (!oauth?.accessToken) return false;
  return isAccessTokenFresh(oauth, now) || !isRefreshTokenExpired(oauth, now);
}

// 把刷新结果并回原始凭据。刷新令牌轮换后，旧的 refreshTokenExpiresAt 不再可信：
// 响应给了新的过期时间就用新的，否则删掉，避免之后被误判成「已过期」而不再尝试。
function mergeRefreshedOAuth(raw, refreshed) {
  const next = { ...(raw || {}), ...refreshed };
  const rotated = Boolean(refreshed?.refreshToken && refreshed.refreshToken !== raw?.refreshToken);
  if (timestamp(refreshed?.refreshTokenExpiresAt)) {
    next.refreshTokenExpiresAt = timestamp(refreshed.refreshTokenExpiresAt);
  } else if (rotated) {
    delete next.refreshTokenExpiresAt;
  }
  return next;
}

module.exports = {
  isAccessTokenFresh,
  isRefreshTokenExpired,
  isCredentialUsable,
  mergeRefreshedOAuth
};
