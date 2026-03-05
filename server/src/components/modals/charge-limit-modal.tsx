import React, { useState } from 'react';
import { Box, Button, Group, Slider, Text, Title } from '@mantine/core';
import { useVehicleMutation } from '../../hooks/mutations/use-device-mutations';
import type { RestDeviceResponse, CapabilityApiResponse } from '../../api/types';

type ElectricVehicleCapability = Extract<CapabilityApiResponse, { type: 'ELECTRIC_VEHICLE' }>;

interface ChargeLimitModalProps {
  device: RestDeviceResponse;
  capability: ElectricVehicleCapability;
  closeModal: () => void;
}

export default function ChargeLimitModal({ device, capability, closeModal }: ChargeLimitModalProps) {
  const [limit, setLimit] = useState<number>(Math.round(capability.chargeLimit.value));
  const { mutate: updateVehicle, isPending } = useVehicleMutation(device.id);

  const handleSubmit = () => {
    updateVehicle({ chargeLimit: limit }, { onSuccess: () => closeModal() });
  };

  return (
    <>
      <Title order={3} mb="md">Set Charge Limit for {device.name}</Title>
      <Text mb="sm">Current Charge: <strong>{capability.chargePercentage.value.toFixed(0)}%</strong></Text>
      <Box my="xl">
        <Text size="sm" fw={500} mb="xs">Charge Limit</Text>
        <Slider
          value={limit}
          onChange={setLimit}
          min={50}
          max={100}
          step={5}
          marks={[50, 60, 70, 80, 90, 100].map(v => ({ value: v, label: `${v}%` }))}
          label={(v) => `${v}%`}
        />
      </Box>
      <Text ta="center" size="xl" fw={700} mt="md" mb="xl">{limit}%</Text>
      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={closeModal}>Cancel</Button>
        <Button loading={isPending} onClick={handleSubmit}>Set Limit</Button>
      </Group>
    </>
  );
}
