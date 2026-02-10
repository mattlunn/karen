import smartcar from 'smartcar';
import config from '../../config';
import { saveConfig } from '../../helpers/config';

const KM_TO_MILES = 0.621371;

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;
let pendingTokenRequest: Promise<string> | null = null;

/**
 * Get a valid access token, refreshing if necessary
 */
async function getAccessToken(): Promise<string> {
  // If there's already a pending request, wait for it
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  // If we have a cached token that hasn't expired, use it
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  // Otherwise, refresh the token
  pendingTokenRequest = refreshAccessToken().finally(() => {
    pendingTokenRequest = null;
  });

  return pendingTokenRequest;
}

async function refreshAccessToken(): Promise<string> {
  const authClient = new smartcar.AuthClient({
    clientId: config.smartcar.client_id,
    clientSecret: config.smartcar.client_secret,
    redirectUri: 'urn:ietf:wg:oauth:2.0:oob', // Placeholder (not used for refresh token exchange)
    mode: 'live',
  });

  const result = await authClient.exchangeRefreshToken(config.smartcar.refresh_token);

  // Update refresh token in config if it changed
  if (result.refreshToken && result.refreshToken !== config.smartcar.refresh_token) {
    config.smartcar.refresh_token = result.refreshToken;
    saveConfig();
  }

  // Cache the new access token
  tokenCache = {
    accessToken: result.accessToken,
    expiresAt: Date.now() + (result.expiresIn * 1000) - 60000, // 1 min buffer
  };

  return result.accessToken;
}

/**
 * Get a SmartCar vehicle instance
 */
async function getVehicle() {
  const accessToken = await getAccessToken();
  return new smartcar.Vehicle(config.smartcar.vehicle_id, accessToken);
}

/**
 * Get vehicle attributes (make, model, year)
 */
export async function getVehicleAttributes(): Promise<{ id: string; make: string; model: string; year: number }> {
  const vehicle = await getVehicle();
  const attributes = await vehicle.attributes();
  return attributes;
}

/**
 * Get battery level and range
 * Returns percentage as 0-100 (SmartCar returns 0-1)
 */
export async function getBattery(): Promise<{ percentRemaining: number; range: number }> {
  const vehicle = await getVehicle();
  const battery = await vehicle.battery();
  return {
    percentRemaining: battery.percentRemaining * 100,
    range: battery.range * KM_TO_MILES, // Convert km to miles
  };
}

/**
 * Get charge status
 */
export async function getChargeStatus(): Promise<{ isPluggedIn: boolean; state: string }> {
  const vehicle = await getVehicle();
  const charge = await vehicle.charge();
  return charge;
}

/**
 * Get odometer reading
 * Returns distance in miles (SmartCar returns km)
 */
export async function getOdometer(): Promise<number> {
  const vehicle = await getVehicle();
  const result = await vehicle.odometer();
  return result.distance * KM_TO_MILES;
}

/**
 * Get charge limit
 * Returns percentage as 0-100 (SmartCar returns 0-1)
 */
export async function getChargeLimit(): Promise<number> {
  const vehicle = await getVehicle();
  const result = await vehicle.getChargeLimit();
  return result.limit * 100;
}

/**
 * Set charge limit
 * Accepts percentage as 0-100 (SmartCar expects 0-1)
 */
export async function setChargeLimit(limit: number): Promise<void> {
  const vehicle = await getVehicle();
  await vehicle.setChargeLimit(limit / 100);
}

/**
 * Start charging
 */
export async function startCharge(): Promise<void> {
  const vehicle = await getVehicle();
  await vehicle.startCharge();
}

/**
 * Stop charging
 */
export async function stopCharge(): Promise<void> {
  const vehicle = await getVehicle();
  await vehicle.stopCharge();
}
