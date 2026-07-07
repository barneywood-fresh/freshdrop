# FreshDrop — Frame.io client upload portal

Give clients a link. They drop files in. Files land straight in a Frame.io folder.
No client login, no seat cost, no third-party SaaS fee.

## How it works

- You connect your Frame.io account **once** (`/connect`) — this is the only login involved.
- Clients get a link like `https://yoursite.netlify.app/?folder=FOLDER_ID&client=Ana`
- When they drop a file, the browser asks your backend for an upload slot, then uploads
  the file straight to Frame.io's storage (Amazon S3) — the file bytes never pass through
  Netlify, so there's no size limit imposed by us.

## One-time setup

### 1. Environment variables (Netlify → Site settings → Environment variables)

| Variable | Value |
|---|---|
| `ADOBE_CLIENT_ID` | From Adobe Developer Console → your OAuth Web App credential |
| `ADOBE_CLIENT_SECRET` | Same page |
| `ADOBE_REDIRECT_URI` | `https://YOUR-SITE.netlify.app/oauth/callback` — must exactly match what's in Adobe Console |
| `ADMIN_SECRET` | Any password you make up — protects the `/connect` route so randoms can't hijack your Frame.io login |
| `NETLIFY_SITE_ID` | Netlify → Site settings → General → Site details → "Site ID" |
| `NETLIFY_BLOBS_TOKEN` | A Personal Access Token: click your avatar (top right in Netlify) → User settings → Applications → Personal access tokens → New access token |
| `RESEND_API_KEY` | From resend.com - free account, create an API key. Without domain verification, notification emails can only reliably reach the address you signed up to Resend with. |

## Setting up a new client portal

Visit `https://YOUR-SITE.netlify.app/admin.html?key=YOUR_ADMIN_SECRET` - pick a project/folder (or create a new subfolder), set a notification email, write a welcome message, and it hands you back a ready-to-send link like `https://YOUR-SITE.netlify.app/?p=abc123`. Clients enter their name/email once before uploading, and every upload is logged (visible in the page's "Already in this folder" panel) and emails the notify address.

### 2. Update Adobe Developer Console

Once your site has a real Netlify URL, go back to your OAuth Web App credential and set:
- **Default redirect URI**: `https://YOUR-SITE.netlify.app/oauth/callback`
- **Redirect URI pattern**: `https://YOUR-SITE\.netlify\.app/oauth/callback` (note the escaped dots)

### 3. Connect your Frame.io account

Visit `https://YOUR-SITE.netlify.app/connect?key=YOUR_ADMIN_SECRET` in a browser, log in with
your Adobe ID, approve access. You should land on a page confirming your Frame.io account ID.
This only needs to happen again if the refresh token eventually expires (Adobe's refresh
tokens are long-lived but not permanent).

### 4. Find a folder ID

In Frame.io, open the folder you want a client uploading into. The folder ID is in the URL,
or via the API (`GET /v4/accounts/{account_id}/projects` → drill into folders).

### 5. Send the link

```
https://YOUR-SITE.netlify.app/?folder=FOLDER_ID&client=Ana%20Torres
```

The `client` param is just cosmetic (shows their name on the page) — it's the `folder` param
that determines where files land. Different folder ID = different link = different destination.

## One thing to verify before relying on this

The request body in `netlify/functions/create-upload.js` for Frame.io's "Create File (local
upload)" endpoint is our best reading of the public docs and SDK signature — Frame.io's fully
authenticated API reference wasn't accessible to confirm the exact field names. Before sending
this to a real client, run one test upload yourself first. If Frame.io returns a 422 or similar
validation error, the response body will say which field it didn't like — that's the only
function that would need adjusting.

## Local file map

```
netlify.toml                        — routing config
package.json                        — one dependency (Netlify Blobs, for token storage)
netlify/functions/oauth-start.js    — kicks off your one-time login
netlify/functions/oauth-callback.js — receives the login, stores tokens
netlify/functions/create-upload.js  — client-facing: registers a file, returns S3 upload URLs
netlify/functions/_lib/tokens.js    — shared token storage + auto-refresh logic
public/index.html                   — the page clients actually see and drop files into
```
