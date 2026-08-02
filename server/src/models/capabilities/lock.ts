import { DeviceCapabilityEvents, LockBaseCapability } from './capabilities.gen';

export class LockCapability extends LockBaseCapability {
  async ensureIsLocked(abortSignal: AbortSignal): Promise<void> {
    const device = this.device;

    if (await this.getIsLocked()) {
      return;
    }

    return new Promise((res, rej) => {
      function cleanup() {
        DeviceCapabilityEvents.offLockIsJammed(doorJammedHandler);
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

      DeviceCapabilityEvents.onLockIsJammed(d => d.id === device.id, doorJammedHandler);
      DeviceCapabilityEvents.onLockIsLockedStart(d => d.id === device.id, doorLockedHandler);

      this.setIsLocked(true);
    });
  }
}