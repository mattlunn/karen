import { Device } from '../../models';
import { Request } from 'express';

export default class Camera {
  #camera: Device;

  __typename = 'Camera';

  constructor(camera: Device) {
    this.#camera = camera;
  }

  snapshot(_: never, { req }: { req: Request }) {
    return `${req.protocol}://${req.headers.host}/api/snapshot/${this.#camera.providerId}`;
  }
}