import * as db from '../../models';
import Room from '../models/room';

export default class RoomLoader {
  #map: Map<number, Room>;
  #resolved: boolean

  constructor() {
    this.#map = new Map();
    this.#resolved = false;
  }

  async load() {
    if (!this.#resolved) {
      for (const room of await db.Room.findAll({ order: ['displayWeight' ]})) {
        this.#map.set(room.id as number, new Room(room));
      }

      this.#resolved = true;
    }
  }

  async findAll(): Promise<IteratorObject<Room>> {
    await this.load();

    return this.#map.values();
  }

  async findById(id: number): Promise<Room | null>{
    await this.load();

    return this.#map.get(id) ?? null;
  }
}
