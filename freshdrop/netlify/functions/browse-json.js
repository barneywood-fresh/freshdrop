const { getValidAccessToken, loadTokens } = require('./_lib/tokens');

// GET /api/browse-json?key=ADMIN_SECRET
// Same data as /api/browse, but as JSON for the admin portal-builder page to consume.

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!process.env.ADMIN_SECRET || key !== process.env.ADMIN_SECRET) {
    return json(403, { error: 'Not authorized' });
  }

  let accessToken, accountId;
  try {
    accessToken = await getValidAccessToken();
    accountId = (await loadTokens()).account_id;
  } catch (err) {
    return json(503, { error: 'Not connected. Visit /connect first.' });
  }

  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    const wsRes = await fetch(`https://api.frame.io/v4/accounts/${accountId}/workspaces`, { headers });
    const wsJson = await wsRes.json();
    if (!wsRes.ok) return json(wsRes.status, wsJson);

    const workspaces = wsJson.data || [];
    const result = [];

    for (const ws of workspaces) {
      const projRes = await fetch(
        `https://api.frame.io/v4/accounts/${accountId}/workspaces/${ws.id}/projects`,
        { headers }
      );
      const projJson = await projRes.json();
      if (!projRes.ok) continue;

      const projects = projJson.data || [];
      const projOut = [];

      for (const proj of projects) {
        const rootFolderId = proj.root_folder_id || proj.root_asset_id;
        if (!rootFolderId) continue;

        const childRes = await fetch(
          `https://api.frame.io/v4/accounts/${accountId}/folders/${rootFolderId}/children`,
          { headers }
        );
        const childJson = await childRes.json();
        const folders = childRes.ok
          ? (childJson.data || []).filter((c) => c.type === 'folder').map((f) => ({ id: f.id, name: f.name }))
          : [];

        projOut.push({
          name: proj.name,
          root_folder_id: rootFolderId,
          folders
        });
      }

      result.push({ name: ws.name, id: ws.id, projects: projOut });
    }

    return json(200, { workspaces: result });
  } catch (err) {
    return json(500, { error: err.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
