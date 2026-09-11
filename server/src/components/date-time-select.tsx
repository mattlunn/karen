import React from 'react';
import { DatePicker } from '@mantine/dates';
import { Group, NativeSelect, Stack, Text } from '@mantine/core';
import dayjs, { Dayjs } from '../dayjs';
import { range } from '../helpers/iterable';

interface DateTimeSelectProps {
  value: Dayjs;
  onChange: (value: Dayjs) => void;
  minDate?: Date;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function DateTimeSelect({ value, onChange, minDate }: DateTimeSelectProps) {
  const handleDateChange = (date: string | null) => {
    if (date) {
      onChange(dayjs(date).hour(value.hour()).minute(value.minute()));
    }
  };

  return (
    <Group gap="md" align="flex-start">
      <DatePicker
        value={value.toDate()}
        onChange={handleDateChange}
        minDate={minDate}
        size="md"
      />
      <Stack align="center" justify="center" pt="lg">
        <Text size="xl" fw={500}>{value.format('DD/MM/YYYY')}</Text>
        <Group gap="xs">
          <Text>at</Text>
          <NativeSelect
            data={Array.from(range(0, 24)).map(x => ({ value: String(x), label: pad(x) }))}
            value={String(value.hour())}
            onChange={(e) => onChange(value.hour(Number(e.target.value)))}
            w={70}
          />
          <Text>:</Text>
          <NativeSelect
            data={Array.from(range(0, 60, 15)).map(x => ({ value: String(x), label: pad(x) }))}
            value={String(value.minute())}
            onChange={(e) => onChange(value.minute(Number(e.target.value)))}
            w={70}
          />
        </Group>
      </Stack>
    </Group>
  );
}
