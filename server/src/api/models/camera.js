export default class Camera {
  constructor(camera) {
    this.camera = camera;
  }

  name() {
    return this.camera.name;
  }

  id() {
    return this.camera.id;
  }

  snapshot(_, { req }) {
    return `${req.protocol}://${req.headers.host}/api/snapshot/${this.camera.providerId}`;
  }

  async status() {
    return await this.camera.getProperty('connected') ? 'OK' : 'OFFLINE';
  }

  room(_, { rooms }) {
    if (!this.camera.roomId) {
      return null;
    }

    return rooms.findById(this.camera.roomId);
  }
}