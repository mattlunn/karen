import bus from '../../bus';
import { Device, Event } from '..';
import { getBooleanProperty, setBooleanProperty } from './helpers/boolean';

export class LockCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;
  
  getIsLocked(): Promise<boolean> {
    return getBooleanProperty(this.#device, 'locked');
  }

  setIsLockedState(isLocked: boolean): Promise<void> {
    return setBooleanProperty(this.#device, 'locked', isLocked);
  }

  setIsLocked(isLocked: boolean): Promise<void> { 
    return Device.getProviderCapabilities(this.#device.provider).provideLockCapability!().setIsLocked(this.#device, isLocked);
  }

  async ensureIsLocked(abortSignal: AbortSignal): Promise<void> {
    const device = this.#device;

    if (await this.getIsLocked()) {
      return;
    }

    if (await this.getIsJammed()) {
      throw new Error('Lock is jammed');
    }

    return new Promise((res, rej) => {
      function cleanup() {
        bus.off('EVENT_START', eventHandler);
      }
      
      async function eventHandler(event: Event) {
        if (event.deviceId === device.id) {
          if (event.type === 'locked') {
            cleanup();
            res();
          }

          if (event.type === 'is_jammed') {
            cleanup();
            rej(new Error('Lock is jammed'));
          }
        }
      }

      abortSignal.addEventListener('abort', () => {
        cleanup();
        rej(abortSignal.reason);
      });

      bus.on('EVENT_START', eventHandler);
      this.setIsLocked(true);
    });
  }

  getIsJammed(): Promise<boolean> {
    return getBooleanProperty(this.#device, 'is_jammed');
  }

  setIsJammedState(isJammed: boolean): Promise<void> {
    return setBooleanProperty(this.#device, 'is_jammed', isJammed);
  }
}