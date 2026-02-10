declare module 'smartcar' {
  export class AuthClient {
    constructor(config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    });

    exchangeRefreshToken(refreshToken: string): Promise<{
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

    battery(): Promise<{
      percentRemaining: number;
      range: number;
    }>;

    charge(): Promise<{
      isPluggedIn: boolean;
      state: string;
    }>;

    odometer(): Promise<{
      distance: number;
    }>;

    getChargeLimit(): Promise<{
      limit: number;
    }>;

    setChargeLimit(limit: number): Promise<void>;

    startCharge(): Promise<void>;

    stopCharge(): Promise<void>;
  }

  export function hashChallenge(token: string, challenge: string): string;

  export default {
    AuthClient,
    Vehicle,
    hashChallenge,
  };
}
