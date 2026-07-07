const { getValidAccessToken, loadTokens } = require('./_lib/tokens');
const { getStore } = require('@netlify/blobs');

const PORTAL_STORE = 'freshdrop-portals';

function store() {
  return getStore({
    name: PORTAL_STORE,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN
  });
}

// POST /api/create-portal
// body: { key, destination_folder_id, new_folder_name, notify_email, welcome_message, client_label }
// If new_folder_name is set, creates a new subfolder under destination_folder_id and uses that.
// Otherwise uploads go straight into destination_folder_id.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { key, destination_folder_id, new_folder_name, notify_email, welcome_message, client_label } = payload;

  if (!process.env.ADMIN_SECRET || key !== process.env.ADMIN_SECRET) {
    return json(403, { error: 'Not authorized' });
  }
  if (!destination_folder_id) {
    return json(400, { error: 'destination_folder_id is required' });
  }

  let accessToken, accountId;
  try {
    accessToken = await getValidAccessToken();
    accountId = (await loadTokens()).account_id;
  } catch (err) {
    return json(503, { error: 'Not connected. Visit /connect first.' });
  }

  let finalFolderId = destination_folder_id;

  if (new_folder_name && new_folder_name.trim()) {
    const createRes = await fetch(
      `https://api.frame.io/v4/accounts/${accountId}/folders/${destination_folder_id}/folders`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: { name: new_folder_name.trim() } })
      }
    );

    if (!createRes.ok) {
      const text = await createRes.text();
      return json(createRes.status, { error: `Folder creation failed: ${text}` });
    }

    const createJson = await createRes.json();
    finalFolderId = (createJson.data && createJson.data.id) || finalFolderId;
  }

  const portalId = Math.random().toString(36).slice(2, 10);

  await store().setJSON(portalId, {
    folder_id: finalFolderId,
    notify_email: notify_email || null,
    welcome_message: welcome_message || '',
    client_label: client_label || '',
    created_at: new Date().toISOString()
  });

  return json(200, { portal_id: portalId, folder_id: finalFolderId });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
