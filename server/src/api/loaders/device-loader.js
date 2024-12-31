import * as db from '../../models';
import { Device } from '../models';

export default class DeviceLoader {
  constructor() {
    this.map = new Map();
    this.resolved = false;
  }

  async load() {
    if (!this.resolved) {
      for (const device of await db.Device.findAll()) {
        this.map.set(device, Device.create(device));
      }

      this.resolved = true;
    }
  }

  async findAll() {
    await this.load();

    return this.map.values();
  }

  async findByRoomId(roomId) {
    await this.load();

    return Array.from(this.map).filter(([device]) => device.roomId === roomId).map(([_, value]) => value);
  }

  async findByType(type) {
    await this.load();

    return Array.from(this.map).filter(([device]) => device.type === type).map(([_, value]) => value);
  }

  async findById(id) {
    await this.load();

    for (const [device, model] of this.map) {
      if (device.id === id) {
        return model;
      }
    }
  }
}
