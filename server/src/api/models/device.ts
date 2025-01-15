import { Device as DeviceModel } from '../../models';
import RoomLoader from '../loaders/room-loader';
import Thermostat from './thermostat';
import Light from './light';
import Camera from './camera';

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
      }
    }

    return loaders;
  }
}