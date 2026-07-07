const { getStore } = require('@netlify/blobs');

const PORTAL_STORE = 'freshdrop-portals';
const UPLOADS_STORE = 'freshdrop-uploads';

function portalStore() {
  return getStore({
    name: PORTAL_STORE,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN
  });
}

function uploadsStore() {
  return getStore({
    name: UPLOADS_STORE,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN
  });
}

// POST /api/log-upload
// body: { portal, uploader, file_name, size }
// Records the upload for the "already in this folder" panel, and emails the notify address.

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

  const { portal, uploader, file_name, size } = payload;
  if (!portal || !file_name) {
    return { statusCode: 400, body: 'portal and file_name are required' };
  }

  const portalConfig = await portalStore().get(portal, { type: 'json' });
  if (!portalConfig) {
    return { statusCode: 404, body: 'Unknown portal link' };
  }

  const existing = (await uploadsStore().get(portal, { type: 'json' })) || [];
  existing.push({
    file_name,
    size: size || 0,
    uploader: uploader || 'Someone',
    uploaded_at: new Date().toISOString()
  });
  await uploadsStore().setJSON(portal, existing);

  if (portalConfig.notify_email && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'FreshDrop <onboarding@resend.dev>',
          to: portalConfig.notify_email,
          subject: `New upload${portalConfig.client_label ? ` - ${portalConfig.client_label}` : ''}`,
          text: `${uploader || 'Someone'} just uploaded "${file_name}" (${formatBytes(size)}).`
        })
      });
    } catch (err) {
      // Don't fail the whole request just because the email didn't send.
      console.log('Notification email failed:', err.message);
    }
  }

  return { statusCode: 200, body: 'OK' };
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
