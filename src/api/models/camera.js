export default class Camera {
  constructor(camera, context) {
    this.camera = camera;
    this.context = context;
  }

  name() {
    return this.camera.newName;
  }

  id() {
    return this.camera.id;
  }

  snapshot() {
    const { req } = this.context;

    return `${req.protocol}://${req.headers.host}/api/snapshot/${this.camera.id}`;
  }
}