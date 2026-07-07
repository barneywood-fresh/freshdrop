const { getValidAccessToken, loadTokens } = require('./_lib/tokens');

// GET /api/folder-contents?folder=FOLDER_ID
// Returns the current files in a folder, for display on the client upload page.

exports.handler = async (event) => {
  const folderId = event.queryStringParameters && event.queryStringParameters.folder;
  if (!folderId) {
    return json(400, { error: 'folder is required' });
  }

  let accessToken, accountId;
  try {
    accessToken = await getValidAccessToken();
    accountId = (await loadTokens()).account_id;
  } catch (err) {
    return json(503, { error: 'Not connected yet' });
  }

  const res = await fetch(
    `https://api.frame.io/v4/accounts/${accountId}/folders/${folderId}/children`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    return json(res.status, { error: text });
  }

  const data = await res.json();
  const items = (data.data || [])
    .filter((item) => item.type === 'file')
    .map((item) => ({
      name: item.name,
      size: item.file_size || item.filesize || 0,
      status: item.status || null,
      created_at: item.inserted_at || item.created_at || null
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return json(200, { items });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
