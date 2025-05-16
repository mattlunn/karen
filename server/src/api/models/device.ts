import { Device as DeviceModel } from '../../models';
import RoomLoader from '../loaders/room-loader';
import Thermostat from './thermostat';
import Light from './light';
import HeatPump from './heat-pump';
import Camera from './camera';
import Lock from './lock';

export default class Device {
  #data: DeviceModel;

  constructor(data: DeviceModel) {
    this.#data = data;
  }

  id(): Number {
    return this.#data.id;
  }

  name(): string {
    return this.#data.name;
  }

  async status(): Promise<'OK' | 'OFFLINE'> {
    return await this.#data.getIsConnected() ? 'OK' : 'OFFLINE';
  }

  room(_: never, { rooms }: { rooms: RoomLoader }) {
    if (!this.#data.roomId) {
      return null;
    }

    return rooms.findById(this.#data.roomId);
  }

  async capabilities(): Promise<Promise<unknown>[]> {
    const capabilities = this.#data.getCapabilities();
    const loaders : Promise<unknown>[] = [];
    
    for (const capability of capabilities) {
      switch (capability) {
        case 'CAMERA':
          loaders.push(Promise.resolve(new Camera(this.#data)));
        break;

        case 'LIGHT_SENSOR':
          loaders.push((async () => {
            const illuminance = await this.#data.getLightSensorCapability().getIlluminance();

            return {
              __typename: 'LightSensor',
              illuminance
            };
          })());
        break;

        case 'HUMIDITY_SENSOR':
          loaders.push((async () => {
            const humidity = await this.#data.getHumiditySensorCapability().getHumidity();

            return {
              __typename: 'HumiditySensor',
              humidity
            };
          })());
        break;

        case 'LIGHT':
          loaders.push(Promise.resolve(new Light(this.#data)));
        break;

        case 'HEAT_PUMP':
          loaders.push(Promise.resolve(new HeatPump(this.#data)));
        break;

        case 'LOCK':
          loaders.push(Promise.resolve(new Lock(this.#data)));
        break;

        case 'MOTION_SENSOR':
          loaders.push((async () => {
            const hasMotion = await this.#data.getMotionSensorCapability().getHasMotion();

            return {
              __typename: 'MotionSensor',
              motionDetected: hasMotion
            };
          })());
        break;

        case 'TEMPERATURE_SENSOR':
          loaders.push((async () => {
            const temperature = await this.#data.getTemperatureSensorCapability().getCurrentTemperature();

            return {
              __typename: 'TemperatureSensor',
              currentTemperature: temperature
            };
          })());
        break;

        case 'THERMOSTAT':
          loaders.push(Promise.resolve(new Thermostat(this.#data)));
        break;

        case 'SPEAKER':
          loaders.push(Promise.resolve({ __typename: 'Speaker' }));
        break;

        case 'SWITCH':
          loaders.push((async () => {
            const isOn = await this.#data.getSwitchCapability().getIsOn();

            return {
              __typename: 'Switch',
              isOn
            };
          })());
        break;

        case 'BATTERY_LEVEL_INDICATOR':
          loaders.push((async () => {
            const batteryPercentage = await this.#data.getBatteryLevelIndicatorCapability().getBatteryPercentage();

            return {
              __typename: 'BatteryLevelIndicator',
              batteryPercentage
            };
          })());
        break;

        case 'BATTERY_LOW_INDICATOR':
          loaders.push((async () => {
            const batteryLow = await this.#data.getBatteryLowIndicatorCapability().getIsBatteryLow();

            return {
              __typename: 'BatteryLowIndicator',
              isLow: batteryLow
            };
          })());
        break;
      }
    }

    return loaders;
  }
}