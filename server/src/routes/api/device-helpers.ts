import { Device, NumericEvent, BooleanEvent } from '../../models';
import { DeviceStatus, NumericEventApiResponse, BooleanEventApiResponse, EnumEventApiResponse } from '../../api/types';

// Type helper to await all promise values in an object
type AwaitedObject<T> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
};

/**
 * Awaits all promise values in an object and returns the resolved object.
 */
export async function awaitPromises<T extends Record<string, unknown>>(obj: T): Promise<AwaitedObject<T>> {
  const entries = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );

  return Object.fromEntries(entries) as AwaitedObject<T>;
}

/**
 * Maps a numeric event promise to API response format.
 */
export function mapNumericEvent(eventsPromise: Promise<NumericEvent[]>): Promise<NumericEventApiResponse> {
  return eventsPromise.then(events => {
    const event = events[0];

    if (!event) {
      throw new Error('Missing an initial event');
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: event.value
    };
  });
}

/**
 * Maps a boolean event promise to API response format.
 */
export function mapBooleanEvent(eventsPromise: Promise<BooleanEvent[]>): Promise<BooleanEventApiResponse> {
  return eventsPromise.then(events => {
    const event = events[0];

    if (!event) {
      throw new Error('Missing an initial event');
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: true
    };
  });
}

/**
 * Heat pump mode mappings from numeric values to strings.
 */
export const HEAT_PUMP_MODES: Record<number, string> = {
  0: 'STANDBY',
  1: 'HEATING',
  2: 'DHW',
  3: 'COOLING'
};

/**
 * Maps a heat pump mode event promise to API response format.
 */
export function mapHeatPumpModeEvent(eventsPromise: Promise<NumericEvent[]>): Promise<EnumEventApiResponse> {
  return eventsPromise.then(events => {
    const event = events[0];

    if (!event) {
      throw new Error('Missing an initial event');
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: HEAT_PUMP_MODES[event.value] ?? 'UNKNOWN'
    };
  });
}

/**
 * Standard selector for retrieving the most recent event.
 */
export const currentSelector = { limit: 1, until: new Date() };

/**
 * Maps a device to a standardized API response structure.
 *
 * This helper reduces code duplication across device capability endpoints by
 * providing a consistent base response format (id, name, status) that each
 * endpoint can extend with capability-specific data.
 *
 * @param device - The device model instance
 * @param isConnected - Whether the device is currently connected
 * @param capabilityData - Capability-specific data to merge into the response
 * @returns Object with id, name, status, and capability-specific data
 */
export function mapDeviceToResponse<T extends Record<string, unknown>>(
  device: Device,
  isConnected: boolean,
  capabilityData: T
): { id: number; name: string; status: DeviceStatus } & T {
  return {
    id: device.id,
    name: device.name,
    status: isConnected ? 'OK' : 'OFFLINE',
    ...capabilityData
  };
}
