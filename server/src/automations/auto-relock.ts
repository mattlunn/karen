import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { BooleanEvent, Device } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

type AutoRelockParameters = {
  locks: {
    name: string;
    delaySeconds: number;
    // Door/window sensor whose state vetoes the relock (see below). Required:
    // without one, Karen has no way to tell the door was opened, and blindly
    // re-throwing the bolt on a timer risks jamming it against an open door.
    doorSensorName: string;
  }[];
};

type PendingRelock = {
  timeout: ReturnType<typeof setTimeout>;
  controller: AbortController;
};

export default function ({ locks }: AutoRelockParameters) {
  for (const { name: lockName, delaySeconds, doorSensorName } of locks) {
    let pending: PendingRelock | undefined;

    function cancelPendingRelock(): void {
      if (pending !== undefined) {
        clearTimeout(pending.timeout);
        pending.controller.abort();
        pending = undefined;
      }
    }

    function scheduleRelock(device: Device): void {
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
          if (pending?.controller === controller) {
            pending = undefined;
          }
        }
      }), delaySeconds * 1000);

      pending = { timeout, controller };
    }

    DeviceCapabilityEvents.onLockIsLockedChanged(
      device => device.name === lockName,
      createBackgroundTransaction('automations:auto-relock:lock-changed', async (event: BooleanEvent) => {
        const device = await event.getDevice();

        // Any lock state change supersedes a scheduled relock.
        cancelPendingRelock();

        // hasEnded() === true means the "locked" event has ended, i.e. the lock is
        // now unlocked. We only ever auto-relock a lock that was left unlocked.
        if (!event.hasEnded()) {
          return;
        }

        // The bolt can only be re-thrown remotely while the door has stayed shut —
        // once opened, the handle must be lifted manually to re-engage. So if the
        // door is already open, there is nothing we can safely do.
        const doorSensor = await Device.findByName(doorSensorName);

        if (doorSensor !== null && await doorSensor.getContactSensorCapability().getIsOpen()) {
          return;
        }

        scheduleRelock(device);
      })
    );

    // If the door opens during the unlocked window, cancel the pending relock.
    // Once opened, the lock needs a manual handle-lift and can't be re-thrown
    // remotely, so we never relock this cycle (nor reschedule when it closes).
    DeviceCapabilityEvents.onContactSensorIsOpenStart(
      device => device.name === doorSensorName,
      createBackgroundTransaction('automations:auto-relock:door-opened', async () => {
        cancelPendingRelock();
      })
    );
  }
}
