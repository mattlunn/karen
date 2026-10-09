// The subset of kia-connect-bridge's vehicle JSON that Karen reads. Field names
// are hyundai_kia_connect_api's Vehicle attributes; each is null until the car
// has reported it.
export interface BridgeVehicle {
  id: string;
  name: string | null;
  model: string | null;
  ev_battery_percentage: number | null;
  ev_battery_is_charging: boolean | null;
  // Reported as an int (e.g. 1 when plugged in on AC), so read as truthy.
  ev_battery_is_plugged_in: boolean | number | null;
  ev_charge_limits_ac: number | null;
  odometer: number | null;
  odometer_unit: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  // The blower speed level: 0 when off.
  air_control_is_on: boolean | number | null;
  // The climate's set temperature. Still reports the last value after climate stops.
  air_temperature: number | null;
  engine_is_running: boolean | number | null;
}

export interface BridgeCommandResponse {
  action_id: string;
  action_status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'UNKNOWN';
  vehicle: BridgeVehicle;
}

// hyundai_kia_connect_api's ClimateRequestOptions. On CCS2 cars, `heating: 1`
// switches on the rear window heater; the steering wheel heater is separate.
export interface ClimateOptions {
  set_temp: number;
  duration: number;
  climate: true;
  defrost: boolean;
  heating: 0 | 1;
  steering_wheel: 0 | 1;
}
