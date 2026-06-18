const https = require('https');

const ZD_SUBDOMAIN  = 'gowit';
const ZD_CLIENT_ID  = 'zendesk_app_';
const ZD_VIEW_ID    = '58996168448793';
const ZD_REDIRECT   = 'https://green-mushroom-0c7b12500.7.azurestaticapps.net/api/zendesk';

function getClientSecret() {
  return process.env.ZD_CLIENT_SECRET || '';
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { reject(new Error('JSON 파싱 실패: ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
  });
}

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const req = https.request({
      hostname, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { reject(new Error('JSON 파싱 실패')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function exchangeCode(code) {
  const res = await httpsPost(`${ZD_SUBDOMAIN}.zendesk.com`, '/oauth/tokens', {
    grant_type:    'authorization_code',
    code,
    client_id:     ZD_CLIENT_ID,
    client_secret: getClientSecret(),
    redirect_uri:  ZD_REDIRECT,
    scope:         'read'
  });
  if (!res.data.access_token) throw new Error('토큰 발급 실패: ' + JSON.stringify(res.data));
  return res.data.access_token;
}

async function fetchAllTickets(token) {
  let allTickets = [], users = {}, orgs = {};
  let url = `https://${ZD_SUBDOMAIN}.zendesk.com/api/v2/views/${ZD_VIEW_ID}/tickets.json?per_page=100&include=users,organizations`;

  while (url) {
    const res = await httpsGet(url, { Authorization: `Bearer ${token}` });
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (res.status !== 200) throw new Error(`API ${res.status}`);

    const d = res.data;
    (d.users  || []).forEach(u => { users[u.id] = u; });
    (d.organizations || []).forEach(o => { orgs[o.id] = o; });

    const statusMap = { open:'등록', pending:'보류', hold:'대기', solved:'해결', closed:'해결' };

    const rows = (d.tickets || []).map(t => {
      const assignee  = users[t.assignee_id]  || {};
      const requester = users[t.requester_id] || {};
      const org       = orgs[t.organization_id] || {};
      const cf = (id) => (t.custom_fields || []).find(f => String(f.id) === String(id))?.value ?? '';
      return {
        ' ID':              t.id,
        '티켓 상태':         statusMap[t.status] || t.status,
        '조직':              org.name  || '',
        '대상시스템':         cf(360014879433) || '',   // 커스텀 필드 ID (추후 수정)
        '요청일':            (t.created_at || '').slice(0, 10),
        '제목':              t.subject || '',
        '요청자':            requester.name || '',
        '종료일':            t.solved_at ? t.solved_at.slice(0, 10) : '',
        '고객 소요시간(H)':   cf(360014879453) || "'-",   // 커스텀 필드 ID (추후 수정)
        '처리자':            assignee.name  || '',
        'CSR 유형':          cf(360014879473) || '',
        '처리내역':           cf(360014879493) || '',
        '전체 소요시간(H)':   cf(360014879513) || "'-",   // 커스텀 필드 ID (추후 수정)
        '요청 날짜':         t.created_at || '',
        '업데이트 시간':      t.updated_at || '',
      };
    });
    allTickets.push(...rows);
    url = d.next_page || null;
  }
  return allTickets;
}

module.exports = async function (context, req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://green-mushroom-0c7b12500.7.azurestaticapps.net',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: corsHeaders, body: '' };
    return;
  }

  const code  = req.query.code;
  const token = req.query.token; // 이미 발급된 토큰 재사용

  // 1) code → access_token 교환 요청
  if (code) {
    try {
      const accessToken = await exchangeCode(code);
      context.res = {
        status: 200,
        headers: corsHeaders,
        body: JSON.stringify({ access_token: accessToken })
      };
    } catch(e) {
      context.res = { status: 400, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
    }
    return;
  }

  // 2) token으로 티켓 목록 가져오기
  if (token) {
    try {
      const tickets = await fetchAllTickets(token);
      context.res = {
        status: 200,
        headers: corsHeaders,
        body: JSON.stringify({ tickets, count: tickets.length })
      };
    } catch(e) {
      const status = e.message === 'UNAUTHORIZED' ? 401 : 500;
      context.res = { status, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
    }
    return;
  }

  context.res = { status: 400, headers: corsHeaders, body: JSON.stringify({ error: 'code 또는 token 파라미터 필요' }) };
};