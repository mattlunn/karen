import config from '../../config';
import type { BridgeCommandResponse, BridgeVehicle, ClimateOptions } from './types';

async function request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.vehicle.bridge_api_token}`,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${config.vehicle.bridge_url}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`kia-connect-bridge request failed (${response.status} ${method} ${path}): ${await response.text()}`);
  }

  return response.json();
}

export function listVehicles(): Promise<BridgeVehicle[]> {
  return request('/vehicles');
}

// Commands take 30-90s: the bridge waits for the car to act, then returns its refreshed state.
export function startCharge(vehicleId: string): Promise<BridgeCommandResponse> {
  return request(`/vehicles/${vehicleId}/start_charge`, 'POST');
}

export function stopCharge(vehicleId: string): Promise<BridgeCommandResponse> {
  return request(`/vehicles/${vehicleId}/stop_charge`, 'POST');
}

export function setChargeLimits(vehicleId: string, limit: number): Promise<BridgeCommandResponse> {
  return request(`/vehicles/${vehicleId}/set_charge_limits`, 'POST', { ac: limit, dc: limit });
}

export function startClimate(vehicleId: string, options: ClimateOptions): Promise<BridgeCommandResponse> {
  return request(`/vehicles/${vehicleId}/start_climate`, 'POST', options);
}

export function stopClimate(vehicleId: string): Promise<BridgeCommandResponse> {
  return request(`/vehicles/${vehicleId}/stop_climate`, 'POST');
}
