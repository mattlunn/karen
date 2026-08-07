import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { BooleanEvent, Device } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

type AutoRelockParameters = {
  locks: {
    name: string;
    delaySeconds: number;
    // Optional door/window sensor. If set, the auto-relock is vetoed the moment
    // the door opens (see below). Omit for timer-only relocking.
    doorSensorName?: string;
  }[];
};

type PendingRelock = {
  timeout: ReturnType<typeof setTimeout>;
  controller: AbortController;
};

export default function ({ locks }: AutoRelockParameters) {
  const configByLockName = new Map(locks.map(lock => [lock.name, lock]));
  const pending = new Map<string, PendingRelock>();

  // Reverse lookup: door sensor name -> the lock(s) it vetoes.
  const locksByDoorSensor = new Map<string, string[]>();

  for (const lock of locks) {
    if (lock.doorSensorName !== undefined) {
      const existing = locksByDoorSensor.get(lock.doorSensorName) ?? [];

      existing.push(lock.name);
      locksByDoorSensor.set(lock.doorSensorName, existing);
    }
  }

  function cancelPendingRelock(lockName: string): void {
    const existing = pending.get(lockName);

    if (existing !== undefined) {
      clearTimeout(existing.timeout);
      existing.controller.abort();
      pending.delete(lockName);
    }
  }

  function scheduleRelock(lockName: string, device: Device, delaySeconds: number): void {
    const controller = new AbortController();

    const timeout = setTimeout(createBackgroundTransaction('automations:auto-relock:relock', async () => {
      try {
        await device.getLockCapability().ensureIsLocked(controller.signal);
      } catch (err) {
        // An abort means a newer unlock (or a door opening) superseded this
        // relock; that's expected, not a failure worth alerting on.
        if (!controller.signal.aborted) {
          bus.emit(NOTIFICATION_TO_ADMINS, {
            message: `Failed to auto-relock ${lockName}: ${err instanceof Error ? err.message : String(err)}`
          });
        }
      } finally {
        // Only clear if this attempt is still the current one for the lock.
        if (pending.get(lockName)?.controller === controller) {
          pending.delete(lockName);
        }
      }
    }), delaySeconds * 1000);

    pending.set(lockName, { timeout, controller });
  }

  DeviceCapabilityEvents.onLockIsLockedChanged(
    device => configByLockName.has(device.name),
    createBackgroundTransaction('automations:auto-relock:lock-changed', async (event: BooleanEvent) => {
      const device = await event.getDevice();
      const lockName = device.name;
      const lock = configByLockName.get(lockName)!;

      // Any lock state change supersedes a scheduled relock.
      cancelPendingRelock(lockName);

      // hasEnded() === true means the "locked" event has ended, i.e. the lock is
      // now unlocked. We only ever auto-relock a lock that was left unlocked.
      if (!event.hasEnded()) {
        return;
      }

      // The bolt can only be re-thrown remotely while the door has stayed shut —
      // once opened, the handle must be lifted manually to re-engage. So if the
      // door is already open, there is nothing we can safely do.
      if (lock.doorSensorName !== undefined) {
        const doorSensor = await Device.findByName(lock.doorSensorName);

        if (doorSensor !== null && await doorSensor.getContactSensorCapability().getIsOpen()) {
          return;
        }
      }

      scheduleRelock(lockName, device, lock.delaySeconds);
    })
  );

  // If the door opens during the unlocked window, cancel the pending relock.
  // Once opened, the lock needs a manual handle-lift and can't be re-thrown
  // remotely, so we never relock this cycle (nor reschedule when it closes).
  DeviceCapabilityEvents.onContactSensorIsOpenStart(
    device => locksByDoorSensor.has(device.name),
    createBackgroundTransaction('automations:auto-relock:door-opened', async (event: BooleanEvent) => {
      const doorSensor = await event.getDevice();

      for (const lockName of locksByDoorSensor.get(doorSensor.name) ?? []) {
        cancelPendingRelock(lockName);
      }
    })
  );
}
