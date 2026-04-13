import https from 'https';
import config from '../../../config.json';

const SITE = 'default';
const agent = new https.Agent({ rejectUnauthorized: false });

let sessionCookie = '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: config.unifi.host,
      port: config.unifi.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie && { Cookie: sessionCookie }),
        ...(payload !== null && { 'Content-Length': Buffer.byteLength(payload) }),
      },
      agent,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            sessionCookie = (Array.isArray(setCookie) ? setCookie : [setCookie])
              .map((c) => c.split(';')[0])
              .join('; ');
          }
          resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

async function login() {
  const { status } = await request('POST', '/api/login', {
    username: config.unifi.username,
    password: config.unifi.password,
  });

  if (status !== 200) {
    throw new Error(`UniFi login failed with status ${status}`);
  }
}

async function getList(endpoint, retry = true) {
  const { status, body } = await request('GET', `/api/s/${SITE}/stat/${endpoint}`);

  if (status === 401 && retry) {
    await login();
    return getList(endpoint, false);
  }

  if (status !== 200) {
    throw new Error(`UniFi API request to ${endpoint} failed with status ${status}`);
  }

  return body.data;
}

export async function getAllUsers() {
  return getList('user');
}

export async function getClientDevices() {
  return getList('sta');
}
