import { DeviceCapabilityEvents, LockBaseCapability } from './capabilities.gen';

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
        DeviceCapabilityEvents.offLockIsJammedStart(doorJammedHandler);
        DeviceCapabilityEvents.offLockIsLockedStart(doorLockedHandler);
      }

      function doorJammedHandler() {
        cleanup();
        rej(new Error('Lock is jammed'));
      }

      function doorLockedHandler() {
        cleanup();
        res();
      }

      abortSignal.addEventListener('abort', () => {
        cleanup();
        rej(abortSignal.reason);
      });

      DeviceCapabilityEvents.onLockIsJammedStart(d => d.id === device.id, doorJammedHandler);
      DeviceCapabilityEvents.onLockIsLockedStart(d => d.id === device.id, doorLockedHandler);

      this.setIsLocked(true);
    });
  }
}