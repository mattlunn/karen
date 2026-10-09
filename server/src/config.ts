import { readFileSync } from 'fs';
import { join } from 'path';
import { decryptSecrets, readKey } from './helpers/crypto';

export type DeepReadonly<T> =
  T extends (infer U)[] ? DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

export interface AutomationConfig {
  name: string;
  parameters?: Record<string, unknown>;
}

export interface AppConfig {
  alexa: {
    id: string;
    client_id: string;
    client_secret: string;
    devices: {
      id: string;
      name: string;
    }[];
  };
  s3: {
    access_key_id: string;
    secret_access_key: string;
    bucket_name: string;
    bucket_region: string;
  };
  location: {
    client_id: string;
    unclaimed_eta_search_window_in_minutes: number;
    latitude: number;
    longitude: number;
  };
  pushover: {
    admin_token: string;
    application_token: string;
  };
  database: {
    host: string;
    name: string;
    user: string;
    password: string;
  };
  zwave: {
    host: string;
    user: string;
    password: string;
  };
  tado: {
    home_id: number;
    secret: string;
    sync_cron: string;
    passive_zone_names: string[];
  };
  shelly: {
    user: string;
    password: string;
    mqtt: {
      url: string;
      user: string;
      password: string;
    };
  };
  sony_bravia: {
    devices: {
      name: string;
      host: string;
      psk: string;
      channels: { label: string; number: number; aliases?: string[] }[];
    }[];
    poll_cron: string;
    connect_timeout_milliseconds: number;
  };
  tplink: {
    sync_cron: string;
    discovery_duration_seconds: number;
    connect_timeout_milliseconds: number;
  };
  tuya: {
    devices: {
      name: string;
      id: string;
      key: string;
      ip: string;
      version: string;
    }[];
    poll_cron: string;
    connect_timeout_milliseconds: number;
  };
  synology: {
    length_of_motion_event_in_seconds: number;
    maximum_length_of_event_in_seconds: number;
    secret: string;
  };
  newrelic: {
    app_name: string;
    license_key: string;
  };
  unifi: {
    host: string;
    port: number;
    username: string;
    password: string;
    device_considered_gone_after_in_seconds: number;
    device_check_cron: string;
  };
  ebusd: {
    host: string;
    port: number;
    poll_cron: string;
    min_mode_duration_minutes: number | undefined;
    dhw_plan_mode: 'readonly' | 'readwrite' | undefined;
    dhw_planning_horizon_hours: number;
    dhw_check_cron: string;
    dhw_standard_target_temp: number;
    dhw_plunge_target_temp: number;
    dhw_legionella_target_temp: number;
    dhw_legionella_temp_tolerance: number;
    dhw_legionella_max_interval_days: number;
    dhw_legionella_alert_grace_days: number;
    dhw_legionella_alert_check_cron: string;
  };
  homeconnect: {
    client_id: string;
    client_secret: string;
    secret: string;
    access_token: string;
  };
  raildata: {
    api_key: string;
  };
  octopus: {
    api_key: string;
    account_number: string;
    poll_rates_cron: string;
    poll_current_power_cron: string;
    forward_price_check_cron: string;
    mpan: string;
    serial_number: string;
  };
  vehicle: {
    bridge_url: string;
    bridge_api_token: string;
    charge_plan_mode: 'readonly' | 'readwrite' | undefined;
    default_charge_limit: number;
    charge_power_watts: number;
    battery_capacity_kwh: number;
    charge_start_buffer_hours: number;
    charge_schedules: {
      target_percentage: number;
      target_time_of_day: string;
      anchor_date: string;
      interval_weeks: number;
    }[];
    charge_baseline_history_days: number;
    charge_plunge_limit: number;
    charge_deadline_engage_days: number;
    charge_baseline_min_percentile: number;
    charge_baseline_max_percentile: number;
  };
  eink: {
    secret: string;
    appliance_schedule: {
      render_cron: string;
      transfer_gap_minutes: number;
      negligible_saving_pence: number;
      appliances: {
        id: string;
        label: string;
        cycle_minutes: number;
        power_profile_kwh: number[];
        delay_min_hours: number;
        delay_max_hours: number;
      }[];
      wash_then_dry: {
        washer_id: string;
        dryer_id: string;
        label: string;
      };
    };
  };
  bins: {
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
  automations: AutomationConfig[];
  port: number;
  trust_proxy: boolean;
  days_to_keep_recordings_while_home: number;
}

const appJson = JSON.parse(readFileSync(join(__dirname, '../config/app.json'), 'utf8'));
let key: Buffer | undefined;

const config: DeepReadonly<AppConfig> = decryptSecrets(appJson, () => key ??= readKey(join(__dirname, '../config/config.key'))) as AppConfig;

export default config;
