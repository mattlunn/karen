declare namespace _default {
  export namespace alexa {
    const id: string;
    const client_id: string;
    const client_secret: string;
    const devices: {
      id: string;
      name: string;
    }[];
    let access_token: string;
    let refresh_token: string;
  }
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
    let refresh_token: string;
    const secret: string;
    const sync_cron: string;
    const passive_zone_names: string[];
  }
  export namespace shelly {
    const user: string;
    const password: string;
    export namespace mqtt {
      const url: string;
      const user: string;
      const password: string;
    }
  }
  export namespace sony_bravia {
    const devices: {
      name: string;
      host: string;
      psk: string;
      channels: { label: string; number: number; aliases?: string[] }[];
    }[];
    const poll_cron: string;
    const connect_timeout_milliseconds: number;
  }
  export namespace tplink {
    const sync_cron: string;
    const discovery_duration_seconds: number;
    const connect_timeout_milliseconds: number;
  }
  export namespace tuya {
    const devices: {
      name: string;
      id: string;
      key: string;
      ip: string;
      version: string;
    }[];
    const poll_cron: string;
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
  export namespace unifi {
    const host: string;
    const port: number;
    const username: string;
    const password: string;
    const device_considered_gone_after_in_seconds: number;
    const device_check_cron: string;
  }
  export namespace ebusd {
    const host: string;
    const port: number;
    const poll_cron: string;
    const min_mode_duration_minutes: number | undefined;
    const dhw_plan_mode: 'readonly' | 'readwrite' | undefined;
    const dhw_planning_horizon_hours: number;
    const dhw_check_cron: string;
    const dhw_standard_target_temp: number;
    const dhw_plunge_target_temp: number;
    const dhw_legionella_target_temp: number;
    const dhw_legionella_temp_tolerance: number;
    const dhw_legionella_max_interval_days: number;
    const dhw_legionella_alert_grace_days: number;
    const dhw_legionella_alert_check_cron: string;
  }
  export namespace homeconnect {
    const client_id: string;
    const client_secret: string;
    const secret: string;
    const access_token: string;
  }
  export namespace raildata {
    const api_key: string;
  }
  export namespace octopus {
    const api_key: string;
    const account_number: string;
    const poll_rates_cron: string;
    const poll_current_power_cron: string;
    const forward_price_check_cron: string;
    const mpan: string;
    const serial_number: string;
  }
  export namespace smartcar {
    const application_id: string;
    const client_id: string;
    const client_secret: string;
    let user_id: string;
    let vehicle_id: string;
    const application_management_token: string;
    const secret: string;
    const charge_plan_mode: 'readonly' | 'readwrite' | undefined;
    const default_charge_limit: number;
    const charge_power_watts: number;
    const battery_capacity_kwh: number;
    const charge_start_buffer_hours: number;
    const charge_schedules: {
      target_percentage: number;
      target_time_of_day: string;
      anchor_date: string;
      interval_weeks: number;
    }[];
    const charge_median_rate_days: number;
    const charge_plunge_limit: number;
    const charge_deadline_engage_fraction: number;
  }
  const bins: {
    overrides: {
      originalDate: string;
      newDate: string;
    }[];
    items: {
      id: string;
      name: string;
      color: string;
      anchorDate: string;
      intervalWeeks: number;
    }[];
  };
  const port: number;
  const trust_proxy: boolean;
  const days_to_keep_recordings_while_home: number;
}
export default _default;