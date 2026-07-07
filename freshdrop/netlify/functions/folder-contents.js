const { getStore } = require('@netlify/blobs');

const UPLOADS_STORE = 'freshdrop-uploads';

function uploadsStore() {
  return getStore({
    name: UPLOADS_STORE,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN
  });
}

// GET /api/folder-contents?p=PORTAL_ID
// Returns the upload log for this portal (what's been sent through this link, and by whom).

exports.handler = async (event) => {
  const portalId = event.queryStringParameters && event.queryStringParameters.p;
  if (!portalId) {
    return json(400, { error: 'p is required' });
  }

  const items = (await uploadsStore().get(portalId, { type: 'json' })) || [];
  const sorted = [...items].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));

  return json(200, { items: sorted });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
