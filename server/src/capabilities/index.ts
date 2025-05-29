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

export type { LightCapabilityProviderHandlers } from './light_capability';
export type { ThermostatCapabilityProviderHandlers } from './thermostat_capability';
export type { MotionSensorCapabilityProviderHandlers } from './motion_sensor_capability';
export type { TemperatureSensorCapabilityProviderHandlers } from './temperature_sensor_capability';
export type { HeatPumpCapabilityProviderHandlers } from './heat_pump_capability';
export type { LightSensorCapabilityProviderHandlers } from './light_sensor_capability';
export type { HumiditySensorCapabilityProviderHandlers } from './humidity_sensor_capability';
export type { SwitchCapabilityProviderHandlers } from './switch_capability';
export type { SpeakerCapabilityProviderHandlers } from './speaker_capability';
export type { LockCapabilityProviderHandlers } from './lock_capability';
export type { CameraCapabilityProviderHandlers } from './camera_capability';

export class Capability<T, U extends keyof T> {
  device: Device;
  handlers: Pick<T, U>

  constructor(device: Device, handlers: (undefined | ((device: Device) => Pick<T, U>))) {
    this.device = device;

    if (typeof handlers === 'undefined') {
      throw new Error(`Provider ${device.provider} does not handle this capability`);
    }

    this.handlers = handlers(device);
  }
}