import bus from '../../bus';
import { Event } from '..';
import LockBaseCapability from './lock.gen';

export class LockCapability extends LockBaseCapability {
  async ensureIsLocked(abortSignal: AbortSignal): Promise<void> {
    const device = this.device;

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
}