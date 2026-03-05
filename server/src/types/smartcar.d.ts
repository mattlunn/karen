declare module 'smartcar' {
  interface SmartcarSignalError {
    description: string;
    code: string;
    type: string;
    resolution: {
      type: string | null;
    };
  }

  type SmartcarSignalStatus =
    | { value: 'SUCCESS' }
    | { value: 'ERROR'; error: SmartcarSignalError };

  // Capable signal — vehicle supports it, but can succeed or transiently fail
  type SmartcarSignal<
    Code extends string,
    Name extends string,
    Group extends string,
    Body
  > =
    | { code: Code; name: Name; group: Group; status: { value: 'SUCCESS' }; body: Body }
    | { code: Code; name: Name; group: Group; status: { value: 'ERROR'; error: SmartcarSignalError } };

  // Permanently unsupported signal — always VEHICLE_NOT_CAPABLE
  type SmartcarSignalNotCapable<
    Code extends string,
    Name extends string,
    Group extends string
  > = {
    code: Code;
    name: Name;
    group: Group;
    status: { value: 'ERROR'; error: SmartcarSignalError };
  };

  // Discriminated union of all known signal attributes
  export type SmartcarSignalAttributes =
    // Capable signals
    | SmartcarSignal<'charge-detailedchargingstatus', 'DetailedChargingStatus', 'Charge', { value: string }>
    | SmartcarSignal<'charge-ischarging', 'IsCharging', 'Charge', { value: boolean }>
    | SmartcarSignal<'charge-ischargingcableconnected', 'IsChargingCableConnected', 'Charge', { value: boolean }>
    | SmartcarSignal<'charge-timetocomplete', 'TimeToComplete', 'Charge', { value: number }>
    | SmartcarSignal<'closure-doors', 'Doors', 'Closure', { values: Array<{ row: number; column: number; isOpen: boolean; isLocked?: boolean }>; rowCount: number; columnCount: number }>
    | SmartcarSignal<'closure-enginecover', 'EngineCover', 'Closure', { isOpen: boolean }>
    | SmartcarSignal<'closure-fronttrunk', 'FrontTrunk', 'Closure', { isOpen: boolean; isLocked?: boolean }>
    | SmartcarSignal<'closure-islocked', 'IsLocked', 'Closure', { value: boolean }>
    | SmartcarSignal<'closure-reartrunk', 'RearTrunk', 'Closure', { isOpen: boolean; isLocked?: boolean }>
    | SmartcarSignal<'closure-sunroof', 'Sunroof', 'Closure', { isOpen: boolean }>
    | SmartcarSignal<'closure-windows', 'Windows', 'Closure', { values: Array<{ row: number; column: number; isOpen: boolean }>; rowCount: number; columnCount: number }>
    | SmartcarSignal<'internalcombustionengine-amountremaining', 'AmountRemaining', 'InternalCombustionEngine', { value: number; unit: string }>
    | SmartcarSignal<'internalcombustionengine-fuellevel', 'FuelLevel', 'InternalCombustionEngine', { value: number; unit: string }>
    | SmartcarSignal<'internalcombustionengine-range', 'Range', 'InternalCombustionEngine', { value: number; unit: string }>
    | SmartcarSignal<'location-preciselocation', 'PreciseLocation', 'Location', { latitude: number; longitude: number; heading: number; locationType: string }>
    | SmartcarSignal<'lowvoltagebattery-stateofcharge', 'StateOfCharge', 'LowVoltageBattery', { value: number; unit: string }>
    | SmartcarSignal<'lowvoltagebattery-status', 'Status', 'LowVoltageBattery', { value: string }>
    | SmartcarSignal<'odometer-traveleddistance', 'TraveledDistance', 'Odometer', { value: number; unit: string }>
    | SmartcarSignal<'tractionbattery-nominalcapacity', 'NominalCapacity', 'TractionBattery', { capacity: number; source: string; availableCapacities: Array<{ capacity: number; description: string }>; unit: string }>
    | SmartcarSignal<'tractionbattery-stateofcharge', 'StateOfCharge', 'TractionBattery', { value: number; unit: string }>
    | SmartcarSignal<'vehicleidentification-vin', 'VIN', 'VehicleIdentification', { value: string }>
    // Not-capable signals
    | SmartcarSignalNotCapable<'charge-chargelimits', 'ChargeLimits', 'Charge'>
    | SmartcarSignalNotCapable<'charge-chargetimers', 'ChargeTimers', 'Charge'>
    | SmartcarSignalNotCapable<'charge-wattage', 'Wattage', 'Charge'>
    | SmartcarSignalNotCapable<'tractionbattery-range', 'Range', 'TractionBattery'>
    | SmartcarSignalNotCapable<'vehicleuseraccount-permissions', 'Permissions', 'VehicleUserAccount'>;

  // Helper type: only the success variants from the union
  export type SmartcarSuccessSignalAttributes = Extract<SmartcarSignalAttributes, { status: { value: 'SUCCESS' } }>;

  export interface SmartcarSignalEntry {
    id: string;
    type: 'signal';
    attributes: SmartcarSignalAttributes;
    meta: {
      ingestedAt: string;
      retrievedAt?: string;
      oemUpdatedAt?: string;
    };
    links: {
      self: string;
      values?: string;
    };
  }

  export interface SmartcarSignalsResponse {
    body: {
      data: SmartcarSignalEntry[];
      links: {
        self: string;
      };
      included: {
        vehicle: {
          id: string;
          type: 'vehicle';
          attributes: {
            make: string;
            model: string;
            year: number;
            powertrainType: string;
          };
          links: {
            self: string;
          };
        };
      }
    }
  }

  export class AuthClient {
    constructor(config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      mode?: 'test' | 'live';
    });

    exchangeRefreshToken(refreshToken: string): Promise<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>;

    getAuthUrl(options?: {
      state?: string;
      forcePrompt?: boolean;
    }): string;

    exchangeCode(code: string): Promise<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>;
  }

  export class Vehicle {
    constructor(id: string, token: string);

    attributes(): Promise<{
      id: string;
      make: string;
      model: string;
      year: number;
    }>;

    getSignals(): Promise<SmartcarSignalsResponse>;

    setChargeLimit(limit: number): Promise<void>;

    startCharge(): Promise<void>;

    stopCharge(): Promise<void>;
  }

  export function hashChallenge(token: string, challenge: string): string;
  export function verifyPayload(amt: string, signature: string, body: unknown): boolean;

  export default {
    AuthClient,
    Vehicle,
    hashChallenge,
    verifyPayload,
  };
}
