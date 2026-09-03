import React from 'react';
import { Button, Group, Text, Title } from '@mantine/core';
import { useDishwasherMutation } from '../../hooks/mutations/use-device-mutations';
import { humanDate } from '../../helpers/date';
import dayjs from '../../dayjs';
import type { RestDeviceResponse, CapabilityApiResponse } from '../../api/types';

type DishwasherCapability = Extract<CapabilityApiResponse, { type: 'DISHWASHER' }>;

interface DishwasherScheduleModalProps {
  device: RestDeviceResponse;
  capability: DishwasherCapability;
  closeModal: () => void;
}

export default function DishwasherScheduleModal({ device, capability, closeModal }: DishwasherScheduleModalProps) {
  const { mutate: updateDishwasher, isPending, error } = useDishwasherMutation(device.id);
  const scheduledRun = capability.scheduledRun;

  const handleSubmit = () => {
    updateDishwasher({ scheduled: scheduledRun === null }, { onSuccess: () => closeModal() });
  };

  return (
    <>
      <Title order={3} mb="md">Schedule {device.name}</Title>

      {scheduledRun ? (
        <Text mb="sm">
          <strong>{scheduledRun.programName}</strong> starts at <strong>{dayjs(scheduledRun.start).format('HH:mm')} {humanDate(dayjs(scheduledRun.start))}</strong>, finishing around <strong>{dayjs(scheduledRun.end).format('HH:mm')}</strong>.
        </Text>
      ) : (
        <Text mb="sm">
          Runs the program selected on the appliance in the cheapest window Karen can find. Select a program and enable remote start at the panel first; the appliance then counts down to the start itself.
        </Text>
      )}

      {error && <Text c="red" mb="sm">{error.message}</Text>}

      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={closeModal}>Close</Button>
        <Button loading={isPending} onClick={handleSubmit} color={scheduledRun ? 'red' : undefined}>
          {scheduledRun ? 'Cancel Scheduled Run' : 'Schedule Cheapest Run'}
        </Button>
      </Group>
    </>
  );
}
