import React, { useState } from 'react';
import { DatePicker } from '@mantine/dates';
import { Button, Group, NativeSelect, Stack, Text, Title } from '@mantine/core';
import dayjs, { Dayjs } from '../../dayjs';
import { range } from '../../helpers/iterable';
import { useUserMutation } from '../../hooks/mutations/use-user-mutations';

interface EtaPickerProps {
  id: string;
  eta: Dayjs | null;
  closeModal: () => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function EtaPicker({ id, eta, closeModal }: EtaPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(eta ?? dayjs().startOf('day'));
  const { mutate: updateUser, isPending } = useUserMutation(id);

  const handleDateChange = (value: Date | null) => {
    if (value) {
      setSelectedDate(dayjs(value).hour(selectedDate.hour()).minute(selectedDate.minute()));
    }
  };

  const handleSetEta = () => {
    updateUser({ eta: +selectedDate }, {
      onSuccess: () => closeModal()
    });
  };

  return (
    <>
      <Title order={3} mb="md">When will <strong>{id}</strong> be home?</Title>

      <Group gap="md" align="flex-start">
        <DatePicker
          value={selectedDate.toDate()}
          onChange={handleDateChange}
          minDate={new Date()}
          size="md"
        />
        <Stack align="center" justify="center" pt="lg">
          <Text size="xl" fw={500}>{selectedDate.format('DD/MM/YYYY')}</Text>
          <Group gap="xs">
            <Text>at</Text>
            <NativeSelect
              data={Array.from(range(0, 24)).map(x => ({ value: String(x), label: pad(x) }))}
              value={String(selectedDate.hour())}
              onChange={(e) => setSelectedDate(selectedDate.hour(Number(e.target.value)))}
              w={70}
            />
            <Text>:</Text>
            <NativeSelect
              data={Array.from(range(0, 60, 15)).map(x => ({ value: String(x), label: pad(x) }))}
              value={String(selectedDate.minute())}
              onChange={(e) => setSelectedDate(selectedDate.minute(Number(e.target.value)))}
              w={70}
            />
          </Group>
        </Stack>
      </Group>

      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={closeModal}>Cancel</Button>
        <Button loading={isPending} onClick={handleSetEta}>Ok</Button>
      </Group>
    </>
  );
}
