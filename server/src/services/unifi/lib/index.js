import https from 'node:https';
import config from '../../../config.json';

const SITE = 'default';
const TIMEOUT_MS = 5000;

let cookies = {};
let csrfToken = null;
let isUnifiOS = false;
let initialized = false;

function buildCookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

function parseCookies(setCookieHeaders) {
  for (const header of (setCookieHeaders || [])) {
    const [nameValue] = header.split(';');
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx !== -1) {
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();
      cookies[name] = value;
    }
  }
}

function apiRequest(method, path, body = null) {
  const resolvedPath = path.replace('<SITE>', SITE);
  const data = body ? JSON.stringify(body) : null;
  const headers = {
    'Content-Type': 'application/json',
  };
  const cookieHeader = buildCookieHeader();
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }
  if (data) {
    headers['Content-Length'] = Buffer.byteLength(data).toString();
  }

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: config.unifi.host,
      port: config.unifi.port,
      path: resolvedPath,
      method,
      rejectUnauthorized: true,
      timeout: TIMEOUT_MS,
      headers,
    }, (res) => {
      parseCookies(res.headers['set-cookie']);
      if (res.headers['x-csrf-token']) {
        csrfToken = res.headers['x-csrf-token'];
      }

      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode === 401) {
          const err = new Error('Unauthorized');
          err.response = { status: 401 };
          reject(err);
          return;
        }
        if (!responseBody) {
          resolve([]);
          return;
        }
        try {
          const json = JSON.parse(responseBody);
          if (json.meta?.rc === 'error') {
            reject(new Error(json.meta.msg || 'UniFi API error'));
          } else {
            resolve(json.data || []);
          }
        } catch (e) {
          reject(new Error(`Failed to parse UniFi response: ${responseBody.slice(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error('UniFi request timed out')));
    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

function detectControllerType() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: config.unifi.host,
      port: config.unifi.port,
      path: '/',
      method: 'GET',
      rejectUnauthorized: true,
      timeout: TIMEOUT_MS,
    }, (res) => {
      if (res.headers['x-csrf-token']) {
        csrfToken = res.headers['x-csrf-token'];
      }
      res.resume();
      res.on('end', () => {
        if (res.statusCode === 302 && res.headers.location === '/manage') {
          isUnifiOS = false;
          resolve();
        } else if (res.statusCode === 200) {
          isUnifiOS = true;
          resolve();
        } else {
          reject(new Error(`Failed to detect UniFi controller type: HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('UniFi detection timed out')));
    req.on('error', reject);
    req.end();
  });
}

async function login() {
  if (!initialized) {
    await detectControllerType();
    initialized = true;
  }
  const endpoint = isUnifiOS ? '/api/auth/login' : '/api/login';
  await apiRequest('POST', endpoint, {
    username: config.unifi.username,
    password: config.unifi.password,
    rememberMe: true,
  });
}

function resetState() {
  cookies = {};
  csrfToken = null;
  initialized = false;
}

let loginPromise = null;

function ensureAuthenticated() {
  if (!loginPromise) {
    loginPromise = login().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
}

async function withRetry(fn) {
  await ensureAuthenticated();
  try {
    return await fn();
  } catch (e) {
    if (e?.response?.status === 401) {
      resetState();
      await ensureAuthenticated();
      return fn();
    }
    throw e;
  }
}

export async function getAllUsers() {
  return withRetry(() => apiRequest('GET', `/api/s/<SITE>/stat/alluser?type=all&within=8760`));
}

export async function getClientDevices() {
  return withRetry(() => apiRequest('GET', '/api/s/<SITE>/stat/sta/'));
}
