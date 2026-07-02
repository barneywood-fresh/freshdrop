// GET /connect?key=YOUR_ADMIN_SECRET
// Redirects you to Adobe's login/consent screen. Only needs to be run once
// (and again whenever the refresh token eventually expires).

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;

  if (!process.env.ADMIN_SECRET || key !== process.env.ADMIN_SECRET) {
    return {
      statusCode: 403,
      body: 'Not authorized. Visit /connect?key=YOUR_ADMIN_SECRET instead.'
    };
  }

  const scopes = [
    'openid',
    'offline_access',
    'email',
    'profile',
    'additional_info.roles',
    'AdobeID'
  ].join(',');

  const params = new URLSearchParams({
    client_id: process.env.ADOBE_CLIENT_ID,
    redirect_uri: process.env.ADOBE_REDIRECT_URI,
    scope: scopes,
    response_type: 'code'
  });

  const authorizeUrl = `https://ims-na1.adobelogin.com/ims/authorize/v2?${params.toString()}`;

  return {
    statusCode: 302,
    headers: { Location: authorizeUrl }
  };
};
