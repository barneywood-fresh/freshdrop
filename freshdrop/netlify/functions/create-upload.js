const { getValidAccessToken, loadTokens } = require('./_lib/tokens');
const { getStore } = require('@netlify/blobs');

const PORTAL_STORE = 'freshdrop-portals';

function portalStore() {
  return getStore({
    name: PORTAL_STORE,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN
  });
}

// POST /api/create-upload
// body: { portal, file_name, file_size, content_type }
// returns: { file_id, upload_urls: [...] }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  const { portal, file_name, file_size, content_type } = payload;
  if (!portal || !file_name || !file_size) {
    return { statusCode: 400, body: 'portal, file_name and file_size are required' };
  }

  const portalConfig = await portalStore().get(portal, { type: 'json' });
  if (!portalConfig) {
    return { statusCode: 404, body: 'Unknown portal link' };
  }
  const folderId = portalConfig.folder_id;

  let accessToken, accountId;
  try {
    accessToken = await getValidAccessToken();
    accountId = (await loadTokens()).account_id;
  } catch (err) {
    if (err.message === 'NOT_CONNECTED') {
      return { statusCode: 503, body: 'Frame.io isn\'t connected yet. Visit /connect?key=... first.' };
    }
    return { statusCode: 500, body: `Auth error: ${err.message}` };
  }

  const url = `https://api.frame.io/v4/accounts/${accountId}/folders/${folderId}/files`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        name: file_name,
        file_size: file_size,
        media_type: content_type || 'application/octet-stream'
      }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    return { statusCode: res.status, body: `Frame.io error: ${text}` };
  }

  const json = await res.json();
  const file = json.data || json;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: file.id,
      upload_urls: file.upload_urls || [],
      media_type: file.media_type || content_type
    })
  };
};
