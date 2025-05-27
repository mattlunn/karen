import { Device } from '../models';

export { LightCapability } from './light_capability';
export { ThermostatCapability } from './thermostat_capability';
export { MotionSensorCapability } from './motion_sensor_capability';
export { TemperatureSensorCapability } from './temperature_sensor_capability';
export { HeatPumpCapability } from './heat_pump_capability';
export { LightSensorCapability } from './light_sensor_capability';
export { HumiditySensorCapability } from './humidity_sensor_capability';
export { SwitchCapability } from './switch_capability';
export { SpeakerCapability } from './speaker_capability';
export { LockCapability } from './lock_capability';
export { CameraCapability } from './camera_capability';

export interface Capability<T, U extends keyof T> {
  device: Device;
  handlers: Pick<T, U>
}