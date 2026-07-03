const { getValidAccessToken, loadTokens } = require('./_lib/tokens');

// GET /api/browse?key=YOUR_ADMIN_SECRET
// Lists your workspaces -> projects -> top-level folders, with real API IDs,
// so you can copy the correct folder_id instead of guessing from a browser URL.

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!process.env.ADMIN_SECRET || key !== process.env.ADMIN_SECRET) {
    return { statusCode: 403, body: 'Not authorized.' };
  }

  let accessToken, accountId;
  try {
    accessToken = await getValidAccessToken();
    accountId = (await loadTokens()).account_id;
  } catch (err) {
    return html(`Auth error: ${escapeHtml(err.message)}. Try /connect again.`);
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  const log = [];
  let out = '';

  try {
    const wsRes = await fetch(`https://api.frame.io/v4/accounts/${accountId}/workspaces`, { headers });
    const wsJson = await wsRes.json();
    log.push(`GET /workspaces -> ${wsRes.status}`);

    if (!wsRes.ok) {
      return html(`Workspaces call failed (${wsRes.status}): ${escapeHtml(JSON.stringify(wsJson))}`);
    }

    const workspaces = wsJson.data || [];
    if (workspaces.length === 0) {
      return html('No workspaces returned for this account. This may be the known "empty workspaces" provisioning issue.');
    }

    for (const ws of workspaces) {
      out += `<h2>Workspace: ${escapeHtml(ws.name)} <code>${ws.id}</code></h2>`;

      const projRes = await fetch(
        `https://api.frame.io/v4/accounts/${accountId}/workspaces/${ws.id}/projects`,
        { headers }
      );
      const projJson = await projRes.json();
      log.push(`GET /workspaces/${ws.id}/projects -> ${projRes.status}`);

      if (!projRes.ok) {
        out += `<p>Failed to load projects: ${escapeHtml(JSON.stringify(projJson))}</p>`;
        continue;
      }

      const projects = projJson.data || [];
      for (const proj of projects) {
        out += `<h3>Project: ${escapeHtml(proj.name)}</h3>`;
        const rootFolderId = proj.root_folder_id || proj.root_asset_id;

        if (!rootFolderId) {
          out += `<p>(no root folder id on this project object - raw: ${escapeHtml(JSON.stringify(proj))})</p>`;
          continue;
        }

        out += `<p>Root folder ID: <code>${rootFolderId}</code></p>`;

        const childRes = await fetch(
          `https://api.frame.io/v4/accounts/${accountId}/folders/${rootFolderId}/children`,
          { headers }
        );
        const childJson = await childRes.json();
        log.push(`GET /folders/${rootFolderId}/children -> ${childRes.status}`);

        if (!childRes.ok) {
          out += `<p>Couldn't list contents: ${escapeHtml(JSON.stringify(childJson))}</p>`;
          continue;
        }

        const children = childJson.data || [];
        const folders = children.filter(c => c.type === 'folder');
        if (folders.length === 0) {
          out += `<p><em>No subfolders - you can upload straight to the root folder ID above.</em></p>`;
        } else {
          out += '<ul>';
          for (const f of folders) {
            out += `<li>${escapeHtml(f.name)} - <code>${f.id}</code></li>`;
          }
          out += '</ul>';
        }
      }
    }

    return html(out + `<hr><pre style="color:#888;font-size:0.8rem;">${escapeHtml(log.join('\n'))}</pre>`);
  } catch (err) {
    return html(`Unexpected error: ${escapeHtml(err.message)}<br><pre>${escapeHtml(log.join('\n'))}</pre>`);
  }
};

function html(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:700px;">${body}</body></html>`
  };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
