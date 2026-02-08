import React, { useState } from 'react';
import { Modal } from '@mantine/core';
import DeviceControl from '../device-control';
import ThermostatModal from '../modals/thermostat-modal';
import { faThermometerFull } from '@fortawesome/free-solid-svg-icons';
import type { RestDeviceResponse, CapabilityApiResponse } from '../../api/types';

type ThermostatCapability = Extract<CapabilityApiResponse, { type: 'THERMOSTAT' }>;

export default function Thermostat({ device, capability }: { device: RestDeviceResponse; capability: ThermostatCapability }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <DeviceControl
        device={device}
        icon={faThermometerFull}
        color="#ff6f22"
        colorIconBackground={capability.isHeating.value}
        values={[
          `${capability.currentTemperature.value.toFixed(1)}°`,
          `${capability.targetTemperature.value.toFixed(1)}°`,
          `${capability.power.value}%`
        ]}
        iconOnClick={(e) => {
          e.preventDefault();
          setShowModal(true);
        }}
      />

      <Modal opened={showModal} onClose={() => setShowModal(false)} size="md" centered>
        <ThermostatModal
          device={device}
          capability={capability}
          closeModal={() => setShowModal(false)}
        />
      </Modal>
    </>
  );
}
