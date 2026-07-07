const { getStore } = require('@netlify/blobs');

const PORTAL_STORE = 'freshdrop-portals';

function store() {
  return getStore({
    name: PORTAL_STORE,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN
  });
}

// GET /api/portal-config?p=PORTAL_ID
// Returns the public-facing bits of a portal (not the folder ID or notify email).

exports.handler = async (event) => {
  const portalId = event.queryStringParameters && event.queryStringParameters.p;
  if (!portalId) {
    return json(400, { error: 'p is required' });
  }

  const portal = await store().get(portalId, { type: 'json' });
  if (!portal) {
    return json(404, { error: 'Portal not found' });
  }

  return json(200, {
    welcome_message: portal.welcome_message || '',
    client_label: portal.client_label || ''
  });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
