declare module 'smartcar' {
  // The SmartCar SDK is used only to build the Connect URL and to verify
  // incoming webhooks. All V3 REST calls are made directly — see
  // services/vehicle/client.ts.
  export class AuthClient {
    constructor(config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      mode?: 'test' | 'live';
    });

    getAuthUrl(options?: {
      state?: string;
      forcePrompt?: boolean;
    }): string;
  }

  export function hashChallenge(token: string, challenge: string): string;
  export function verifyPayload(amt: string, signature: string, body: unknown): boolean;

  export default {
    AuthClient,
    hashChallenge,
    verifyPayload,
  };
}
