import React, { useState } from 'react';
import { Button, Slider, Text } from '@mantine/core';
import { useThermostatMutation } from '../../hooks/mutations/use-device-mutations';

interface ThermostatCapability {
  targetTemperature: { value: number };
  currentTemperature: { value: number };
}

interface Device {
  id: number;
  name: string;
}

interface ThermostatModalProps {
  device: Device;
  capability: ThermostatCapability;
  closeModal: () => void;
}

export default function ThermostatModal({ device, capability, closeModal }: ThermostatModalProps) {
  const [targetTemperature, setTargetTemperature] = useState<number>(capability.targetTemperature.value);
  const { mutate: updateThermostat, isPending } = useThermostatMutation(device.id);

  const handleSubmit = () => {
    updateThermostat({ targetTemperature }, {
      onSuccess: () => closeModal()
    });
  };

  return (
    <div className="thermostat-modal">
      <div className="thermostat-modal__body">
        <h2>Set Temperature</h2>
        <Text size="sm" c="dimmed" mb="md">{device.name}</Text>
        <Text size="sm" mb="lg">
          Current: <strong>{capability.currentTemperature.value.toFixed(1)}°</strong>
        </Text>
        <div className="thermostat-modal__slider-container">
          <Slider
            value={targetTemperature}
            onChange={setTargetTemperature}
            min={0}
            max={25}
            step={0.5}
            marks={[
              { value: 0, label: '0°' },
              { value: 5, label: '5°' },
              { value: 10, label: '10°' },
              { value: 15, label: '15°' },
              { value: 20, label: '20°' },
              { value: 25, label: '25°' },
            ]}
            label={(value) => `${value.toFixed(1)}°`}
          />
        </div>
        <Text ta="center" size="xl" fw={700} mt="xl">
          {targetTemperature.toFixed(1)}°
        </Text>
      </div>
      <div className="thermostat-modal__footer">
        <Button variant="default" onClick={closeModal} mr="sm">Cancel</Button>
        <Button loading={isPending} onClick={handleSubmit}>Ok</Button>
      </div>
    </div>
  );
}
