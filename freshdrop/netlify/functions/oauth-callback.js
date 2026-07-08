const { exchangeCodeForTokens, loadTokens, saveTokens } = require('./_lib/tokens');

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};

  if (params.error) {
    return html(`Adobe returned an error: ${params.error}. Try /connect again.`);
  }

  if (!params.code) {
    return html('Missing authorization code in the redirect. Try /connect again.');
  }

  try {
    await exchangeCodeForTokens(params.code);

    // Look up the Frame.io account ID now, once, so we don't have to do it on every upload.
    const tokens = await loadTokens();
    const res = await fetch('https://api.frame.io/v4/accounts', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    if (!res.ok) {
      const text = await res.text();
      return html(
        `Connected to Adobe, but the Frame.io accounts lookup failed (${res.status}). ` +
        `Response: ${escapeHtml(text)}. This may be the free-tier "empty workspaces" issue, ` +
        `worth checking that your Frame.io account is fully linked to Adobe Authentication.`
      );
    }

    const accountsJson = await res.json();
    const accounts = accountsJson.data || [];

    if (accounts.length === 0) {
      return html('Connected, but no Frame.io accounts were returned for this login.');
    }

    const KNOWN_FRESH_ACCOUNT_ID = '797bdece-f14c-4d03-bca2-aa372237302c';
    let account = accounts.find((a) => a.id === KNOWN_FRESH_ACCOUNT_ID);

    if (!account && accounts.length === 1) {
      account = accounts[0];
    }

    if (!account) {
      const list = accounts.map((a) => `${escapeHtml(a.name || '(unnamed)')} - <code>${a.id}</code>`).join('<br>');
      return html(
        `This Adobe login has access to multiple Frame.io accounts, and none matched the known Fresh account. ` +
        `Here's what was returned:<br><br>${list}<br><br>Tell Claude which one is Fresh's real account so the code can be updated.`
      );
    }

    await saveTokens({ ...tokens, account_id: account.id });

    return html(
      `Connected. Frame.io account ID: <code>${account.id}</code>${account.name ? ` (${escapeHtml(account.name)})` : ''}. ` +
      `You can close this tab, the upload portal is ready to use.`
    );
  } catch (err) {
    return html(`Something went wrong: ${escapeHtml(err.message)}`);
  }
};

function html(message) {
  const body = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;">${message}</body></html>`;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: Buffer.from(body, 'utf-8').toString('base64'),
    isBase64Encoded: true
  };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
