// Shared token storage + refresh logic.
// Netlify Blobs gives us a tiny persistent key-value store, tied to this site,
// so we don't need an external database just to remember one refresh token.

const { getStore } = require('@netlify/blobs');

const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const STORE_NAME = 'silosync-auth';
const TOKEN_KEY = 'frameio-tokens';

function store() {
  return getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN
  });
}

async function saveTokens(data) {
  await store().setJSON(TOKEN_KEY, data);
}

async function loadTokens() {
  const data = await store().get(TOKEN_KEY, { type: 'json' });
  return data || null;
}

// Exchanges an authorization code (from the one-time "Connect Frame.io" login)
// for an access token + refresh token, and stores both.
async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ADOBE_CLIENT_ID,
    client_secret: process.env.ADOBE_CLIENT_SECRET,
    code,
    redirect_uri: process.env.ADOBE_REDIRECT_URI
  });

  const res = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const record = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in * 1000) - 60000 // refresh 60s early
  };
  await saveTokens(record);
  return record;
}

// Uses the stored refresh token to mint a fresh access token.
async function refreshAccessToken(refreshToken) {
  const existing = await loadTokens();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ADOBE_CLIENT_ID,
    client_secret: process.env.ADOBE_CLIENT_SECRET,
    refresh_token: refreshToken
  });

  const res = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const record = {
    ...existing,
    access_token: json.access_token,
    // Adobe may or may not rotate the refresh token, keep the old one if a new one isn't returned
    refresh_token: json.refresh_token || refreshToken,
    expires_at: Date.now() + (json.expires_in * 1000) - 60000
  };
  await saveTokens(record);
  return record;
}

// Returns a valid access token, refreshing automatically if the stored one has expired.
// Throws if nobody has ever connected their Frame.io account yet.
async function getValidAccessToken() {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error('NOT_CONNECTED');
  }
  if (Date.now() < tokens.expires_at) {
    return tokens.access_token;
  }
  const refreshed = await refreshAccessToken(tokens.refresh_token);
  return refreshed.access_token;
}

module.exports = {
  saveTokens,
  loadTokens,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidAccessToken
};
