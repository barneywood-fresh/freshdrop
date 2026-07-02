const { getValidAccessToken, loadTokens } = require('./_lib/tokens');

// POST /api/create-upload
// body: { folder_id, file_name, file_size, content_type }
// returns: { file_id, upload_urls: [...] }
//
// NOTE: the exact request shape below (`data: { name, file_size, media_type }`)
// is our best read of the docs + SDK signature. If your Postman test of
// "Create File (local upload)" showed a different field name or nesting,
// this is the only place that needs to change.

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

  const { folder_id, file_name, file_size, content_type } = payload;
  if (!folder_id || !file_name || !file_size) {
    return { statusCode: 400, body: 'folder_id, file_name and file_size are required' };
  }

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

  if (!accountId) {
    return { statusCode: 500, body: 'No Frame.io account ID stored — reconnect via /connect' };
  }

  const url = `https://api.frame.io/v4/accounts/${accountId}/folders/${folder_id}/files`;

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
