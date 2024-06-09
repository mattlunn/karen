declare namespace _default {
  export namespace alexa {
      const id: string;
      const client_id: string;
      const client_secret: string;
      const devices: {
          id: string;
          name: string;
      }[];
      const access_token: string;
      const refresh_token: string;
  }
  export const automations: {
      name: string;
      parameters?: Record<string, unknown>;
  }[];
  export namespace s3 {
      const access_key_id: string;
      const secret_access_key: string;
      const bucket_name: string;
      const bucket_region: string;
  }
  export namespace location {
      const client_id: string;
      const unclaimed_eta_search_window_in_minutes: number;
      const latitude: number;
      const longitude: number;
  }
  export namespace pushover {
      const user_token: string;
      const application_token: string;
  }
  export namespace database {
      const host: string;
      const name: string;
      const user: string;
      const password: string;
  }
  export namespace zwave {
      const host: string;
      const user: string;
      const password: string;
  }
  export namespace shelly {
      const user: string;
      const password: string;
      const secret: string;
  }
  const port: number;
  const trust_proxy: boolean;
}
export default _default;