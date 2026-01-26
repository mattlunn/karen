import React from 'react';
import DeviceControl from '../device-control';
import { faDoorClosed, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import { useLockMutation } from '../../hooks/mutations/use-device-mutations';

export default function Lock({ device, capability }) {
  const { mutate: setDoorLockedStatus, isPending: loading } = useLockMutation(device.id);

  return (
    <DeviceControl
      device={device}
      icon={capability.isLocked.value ? faDoorClosed : faDoorOpen}
      color="#04A7F4"
      colorIconBackground={!capability.isLocked.value}
      values={[capability.isLocked.value ? 'Locked' : 'Unlocked']}
      actionPending={loading}
      iconOnClick={(e) => {
        e.preventDefault();

        if (loading) return;

        setDoorLockedStatus({
          isLocked: !capability.isLocked.value
        });
      }}
    />
  );
}
