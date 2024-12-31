import * as db from '../../models';
import Room from '../models/room';

export default class RoomLoader {
  constructor() {
    this.map = new Map();
    this.resolved = false;
  }

  async load() {
    if (!this.resolved) {
      for (const room of await db.Room.findAll({ order: ['displayWeight' ]})) {
        this.map.set(room.id, new Room(room));
      }

      this.resolved = true;
    }
  }

  async findAll() {
    await this.load();

    return this.map.values();
  }

  async findById(id) {
    await this.load();

    return this.map.get(id);
  }
}
