// Runs on a schedule (see netlify.toml). Refreshes the Adobe token so the
// 14 day refresh token expiry clock restarts, even if nobody uploads for a while.
// refreshAccessToken() saves the new refresh token and keeps account_id intact.

const { loadTokens, refreshAccessToken } = require('./_lib/tokens');

exports.handler = async () => {
  try {
    const tokens = await loadTokens();
    if (!tokens || !tokens.refresh_token) {
      console.log('keep-alive: no tokens stored, reconnect via /connect');
      return { statusCode: 200, body: 'not connected' };
    }
    await refreshAccessToken(tokens.refresh_token);
    console.log('keep-alive: token refreshed OK at ' + new Date().toISOString());
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('keep-alive FAILED: ' + err.message);
    return { statusCode: 500, body: err.message };
  }
};
