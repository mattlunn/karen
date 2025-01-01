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
    return await this.#data.getProperty('connected') ? 'OK' : 'OFFLINE';
  }

  room(_: never, { rooms }: { rooms: RoomLoader }) {
    if (!this.#data.roomId) {
      return null;
    }

    return rooms.findById(this.#data.roomId);
  }

  async capabilities(): Promise<Promise<unknown>[]> {
    const sensors = await this.#data.getPropertyKeys();
    const loaders : Promise<unknown>[] = [];

    switch (this.#data.type) {
      case 'thermostat':
        loaders.push(Promise.resolve(new Thermostat(this.#data)));
        break;
      case 'light':
        loaders.push(Promise.resolve(new Light(this.#data)));
        break;
      case 'camera':
        loaders.push(Promise.resolve(new Camera(this.#data)));
        break;
    }

    for (const sensor of sensors) {
      switch (sensor) {
        case 'motion': 
          loaders.push((async () => {
            const hasMotion = await this.#data.getProperty('motion');

            return {
              __typename: 'MotionSensor',
              motionDetected: hasMotion
            };
          })());
        break;
        case 'illuminance': 
          loaders.push((async () => {
            const illuminance = await this.#data.getProperty('illuminance');

            return {
              __typename: 'LightSensor',
              illuminance
            };
          })());
        break;
        case 'temperature': 
          loaders.push((async () => {
            const temperature = await this.#data.getProperty('temperature');

            return {
              __typename: 'TemperatureSensor',
              currentTemperature: temperature
            };
          })());
        break;
      }
    }

    return loaders;
  }
}