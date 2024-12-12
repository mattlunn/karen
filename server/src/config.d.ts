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
    const admin_token: string;
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
  export namespace tado {
    const home_id: number;
    const username: string;
    const password: string;
    const sync_interval_seconds: number;
    const eta_check_interval_minutes: number;
    const linked_zones: string[][];
  }
  export namespace shelly {
    const user: string;
    const password: string;
    const secret: string;
    const webhook_host: string;
  }
  export namespace tplink {
    const discovery_duration_seconds: number;
    const connect_timeout_milliseconds: number;
  }
  export namespace synology {
    const length_of_motion_event_in_seconds: number;
    const maximum_length_of_event_in_seconds: number;
    const secret: string;
  }
  export namespace new_relic {
    const app_name: string;
    const license_key: string;
  }
  export namespace ebusd {
    const host: string;
    const port: number;
    const poll_interval_minutes: number;
  }
  const port: number;
  const trust_proxy: boolean;
  const days_to_keep_recordings_while_home: number;
}
export default _default;