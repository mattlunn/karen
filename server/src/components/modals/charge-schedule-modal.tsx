import React, { useState } from 'react';
import { Box, Button, Group, Slider, Text, Title } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useVehicleMutation } from '../../hooks/mutations/use-device-mutations';
import type { RestDeviceResponse, CapabilityApiResponse } from '../../api/types';
import dayjs from '../../dayjs';

type ElectricVehicleCapability = Extract<CapabilityApiResponse, { type: 'ELECTRIC_VEHICLE' }>;

interface ChargeScheduleModalProps {
  device: RestDeviceResponse;
  capability: ElectricVehicleCapability;
  closeModal: () => void;
}

export default function ChargeScheduleModal({ device, capability, closeModal }: ChargeScheduleModalProps) {
  const [targetPercentage, setTargetPercentage] = useState<number>(100);
  const [targetTime, setTargetTime] = useState<Date>(dayjs().add(1, 'day').hour(7).minute(0).second(0).toDate());
  const { mutate: updateVehicle, isPending } = useVehicleMutation(device.id);

  const handleSubmit = () => {
    updateVehicle({
      chargeSchedule: {
        targetPercentage,
        targetTime: targetTime.toISOString()
      }
    }, {
      onSuccess: () => closeModal()
    });
  };

  return (
    <>
      <Title order={3} mb="md">Schedule Charge for {device.name}</Title>

      <Text>Current Charge: <strong>{capability.chargePercentage.value.toFixed(0)}%</strong></Text>
      <Text mb="sm">Current Limit: <strong>{capability.chargeLimit.value.toFixed(0)}%</strong></Text>

      <Box my="xl">
        <Text size="sm" fw={500} mb="xs">Target Charge Percentage</Text>
        <Slider
          value={targetPercentage}
          onChange={setTargetPercentage}
          min={50}
          max={100}
          step={5}
          marks={[
            { value: 50, label: '50%' },
            { value: 60, label: '60%' },
            { value: 70, label: '70%' },
            { value: 80, label: '80%' },
            { value: 90, label: '90%' },
            { value: 100, label: '100%' },
          ]}
          label={(value) => `${value}%`}
        />
      </Box>

      <Text ta="center" size="xl" fw={700} mt="md" mb="xl">
        {targetPercentage}%
      </Text>

      <Box my="xl">
        <Text size="sm" fw={500} mb="xs">Target Time</Text>
        <DateTimePicker
          value={targetTime}
          onChange={(val) => val && setTargetTime(val)}
          minDate={new Date()}
          clearable={false}
        />
      </Box>

      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={closeModal}>Cancel</Button>
        <Button loading={isPending} onClick={handleSubmit}>Schedule</Button>
      </Group>
    </>
  );
}
