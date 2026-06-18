const https = require('https');

const ZD_SUBDOMAIN  = 'gowit';
const ZD_CLIENT_ID  = 'zendesk_app_';
const ZD_REDIRECT   = 'https://green-mushroom-0c7b12500.7.azurestaticapps.net/index.html';

function httpsPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const req = https.request({
      hostname: `${ZD_SUBDOMAIN}.zendesk.com`,
      path,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': payload.length
      }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { reject(new Error('JSON 파싱 실패: ' + data.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const CORS = {
  'Access-Control-Allow-Origin':  'https://green-mushroom-0c7b12500.7.azurestaticapps.net',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

module.exports = async function (context, req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: CORS, body: '' };
    return;
  }

  const code     = req.query.code     || (req.body && req.body.code);
  const verifier = req.query.verifier || (req.body && req.body.verifier);

  if (!code) {
    context.res = { status: 400, headers: CORS, body: JSON.stringify({ error: 'code 파라미터 필요' }) };
    return;
  }

  try {
    const result = await httpsPost('/oauth/tokens', {
      grant_type:    'authorization_code',
      code,
      client_id:     ZD_CLIENT_ID,
      redirect_uri:  ZD_REDIRECT,
      code_verifier: verifier || '',
      scope:         'read'
    });

    if (!result.data.access_token) {
      throw new Error(result.data.error_description || result.data.error || JSON.stringify(result.data));
    }

    context.res = {
      status: 200,
      headers: CORS,
      body: JSON.stringify({ access_token: result.data.access_token })
    };
  } catch(e) {
    context.res = {
      status: 500,
      headers: CORS,
      body: JSON.stringify({ error: e.message })
    };
  }
};