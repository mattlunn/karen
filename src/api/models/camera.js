export default class Camera {
  constructor(camera) {
    this.camera = camera;
  }

  name() {
    return this.camera.newName;
  }

  id() {
    return this.camera.id;
  }

  snapshot(_, { req }) {
    return `${req.protocol}://${req.headers.host}/api/snapshot/${this.camera.id}`;
  }
}