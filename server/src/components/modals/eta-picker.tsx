import React, { useState } from 'react';
import { Button, Group, Title } from '@mantine/core';
import dayjs, { Dayjs } from '../../dayjs';
import { useUserMutation } from '../../hooks/mutations/use-user-mutations';
import DateTimeSelect from '../date-time-select';

interface EtaPickerProps {
  id: string;
  eta: Dayjs | null;
  closeModal: () => void;
}

export default function EtaPicker({ id, eta, closeModal }: EtaPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(eta ?? dayjs().startOf('day'));
  const { mutate: updateUser, isPending } = useUserMutation(id);

  const handleSetEta = () => {
    updateUser({ eta: +selectedDate }, {
      onSuccess: () => closeModal()
    });
  };

  return (
    <>
      <Title order={3} mb="md">When will <strong>{id}</strong> be home?</Title>

      <DateTimeSelect value={selectedDate} onChange={setSelectedDate} minDate={new Date()} />

      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={closeModal}>Cancel</Button>
        <Button loading={isPending} onClick={handleSetEta}>Ok</Button>
      </Group>
    </>
  );
}
