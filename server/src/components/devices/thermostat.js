import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import DeviceControl from '../device-control';
import Modal from '../modal';
import ThermostatModal from '../modals/thermostat-modal';
import { faThermometerFull } from '@fortawesome/free-solid-svg-icons';

export default function Thermostat({ device, capability }) {
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

      {showModal && ReactDOM.createPortal(
        <Modal>
          <ThermostatModal
            device={device}
            capability={capability}
            closeModal={() => setShowModal(false)}
          />
        </Modal>,
        document.body
      )}
    </>
  );
}
