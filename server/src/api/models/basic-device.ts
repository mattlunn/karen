import { Device } from '../../models';
import RoomLoader from '../loaders/room-loader';

export default class BasicDevice {
  #data: Device;

  constructor(data: Device) {
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

  async sensors(): Promise<Promise<unknown>[]> {
    const sensors = await this.#data.getPropertyKeys();
    const loaders : Promise<unknown>[] = [];

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