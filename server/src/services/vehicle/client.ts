import config from '../../config';
import logger from '../../logger';
import type { SmartcarSignalsResponse, SmartcarConnectionsResponse } from './types';

const IAM_TOKEN_URL = 'https://iam.smartcar.com/oauth2/token';
const V3_BASE_URL = 'https://vehicle.api.smartcar.com/v3';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;
let pendingTokenRequest: Promise<string> | null = null;

/**
 * Get a valid application-level access token, fetching a new one if necessary.
 * V3 uses the OAuth client-credentials grant — there is no refresh token, so an
 * expired token is simply replaced by a fresh one.
 */
async function getAccessToken(): Promise<string> {
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  pendingTokenRequest = fetchAppToken().finally(() => {
    pendingTokenRequest = null;
  });

  return pendingTokenRequest;
}

async function fetchAppToken(): Promise<string> {
  const response = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.smartcar.client_id,
      client_secret: config.smartcar.client_secret,
    }),
  });

  if (!response.ok) {
    throw new Error(`SmartCar token request failed (${response.status}): ${await response.text()}`);
  }

  const { access_token: accessToken, expires_in: expiresIn } = await response.json();

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + (expiresIn * 1000) - 60000, // 1 min buffer
  };

  logger.info('SmartCar: obtained application access token');

  return accessToken;
}

type V3RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  // Whether to send the sc-user-id header — required for vehicle signals and commands.
  scoped?: boolean;
};

async function v3Request(path: string, { method = 'GET', body, scoped = false }: V3RequestOptions = {}) {
  const accessToken = await getAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (scoped) {
    headers['sc-user-id'] = config.smartcar.user_id;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${V3_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`SmartCar V3 request failed (${response.status} ${method} ${path}): ${await response.text()}`);
  }

  return response.json();
}

/**
 * List the vehicle connections for a given user.
 */
export async function listConnections(userId: string): Promise<SmartcarConnectionsResponse> {
  return v3Request(`/connections?filter[user_id]=${encodeURIComponent(userId)}`);
}

/**
 * Get the latest signals (battery %, charging state, odometer, etc.). The
 * response also includes the vehicle's make/model/year under `included.vehicle`.
 */
export async function getSignals(): Promise<SmartcarSignalsResponse> {
  return v3Request(`/vehicles/${config.smartcar.vehicle_id}/signals`, { scoped: true });
}

/**
 * Set charge limit. Accepts percentage as 0-100 (SmartCar expects 0-1).
 */
export async function setChargeLimit(limit: number): Promise<void> {
  await v3Request(`/vehicles/${config.smartcar.vehicle_id}/charge/limit`, {
    method: 'POST',
    body: { limit: String(limit / 100) },
    scoped: true,
  });
}

/**
 * Start charging.
 */
export async function startCharge(): Promise<void> {
  await v3Request(`/vehicles/${config.smartcar.vehicle_id}/charge`, {
    method: 'POST',
    body: { action: 'START' },
    scoped: true,
  });
}

/**
 * Stop charging.
 */
export async function stopCharge(): Promise<void> {
  await v3Request(`/vehicles/${config.smartcar.vehicle_id}/charge`, {
    method: 'POST',
    body: { action: 'STOP' },
    scoped: true,
  });
}
