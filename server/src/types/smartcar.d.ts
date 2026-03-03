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

  type SmartcarSignalBody =
    | { value: string }
    | { value: number; unit: string }
    | { value: boolean }
    | { isOpen: boolean; isLocked?: boolean }
    | { values: Array<{ row: number; column: number; isOpen: boolean; isLocked?: boolean }>; rowCount: number; columnCount: number }
    | { latitude: number; longitude: number; heading: number; locationType: string }
    | { capacity: number; source: string; availableCapacities: Array<{ capacity: number; description: string }>; unit: string };

  export interface SmartcarSignal {
    id: string;
    type: 'signal';
    attributes: {
      code: string;
      name: string;
      group: string;
      status: SmartcarSignalStatus;
      body?: SmartcarSignalBody;
    };
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
      data: SmartcarSignal[];
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
