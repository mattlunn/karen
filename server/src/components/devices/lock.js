import React from 'react';
import DeviceControl from '../device-control';
import { faDoorClosed, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import useApiMutation from '../../hooks/api-mutation';

export default function Lock({ device, capability }) {
  const { mutate: setDoorLockedStatus, loading } = useApiMutation(`/device/${device.id}/lock`);

  return (
    <DeviceControl
      device={device}
      icon={capability.isLocked ? faDoorClosed : faDoorOpen}
      color="#04A7F4"
      colorIconBackground={capability.isLocked}
      values={[capability.isLocked ? 'Locked' : 'Unlocked']}
      actionPending={loading}
      iconOnClick={(e) => {
        e.preventDefault();

        if (loading) return;

        setDoorLockedStatus({
          isLocked: !capability.isLocked
        });
      }}
    />
  );
}
