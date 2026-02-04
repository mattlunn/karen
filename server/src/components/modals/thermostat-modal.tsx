import React, { useState } from 'react';
import { Box, Button, Group, Slider, Text, Title } from '@mantine/core';
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
    <>
      <Title order={3} mb="md">Set Temperature for {device.name}</Title>

      <Text>Current Temperature: <strong>{capability.currentTemperature.value.toFixed(1)}°</strong></Text>
      <Text mb="sm">Current Target: <strong>{capability.targetTemperature.value.toFixed(1)}°</strong></Text>

      <Box my="xl">
        <Slider
          value={targetTemperature}
          onChange={setTargetTemperature}
          min={0}
          max={25}
          step={0.5}
          marks={[
            { value: 0, label: 'Off' },
            { value: 5, label: '5°' },
            { value: 10, label: '10°' },
            { value: 15, label: '15°' },
            { value: 20, label: '20°' },
            { value: 25, label: '25°' },
          ]}
          label={(value) => `${value.toFixed(1)}°`}
        />
      </Box>
      <Text ta="center" size="xl" fw={700} mt="xl">
        {targetTemperature.toFixed(1)}°
      </Text>

      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={closeModal}>Cancel</Button>
        <Button loading={isPending} onClick={handleSubmit}>Ok</Button>
      </Group>
    </>
  );
}
