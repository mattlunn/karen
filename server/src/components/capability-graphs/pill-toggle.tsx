import React, { ReactNode, useState } from 'react';
import { SegmentedControl } from '@mantine/core';

export type PillOption = {
  value: string;
  label: string;
};

export function usePillToggle(options?: PillOption[]): { value: string | undefined; control: ReactNode } {
  const [value, setValue] = useState(options?.[0]?.value);

  if (!options) {
    return { value: undefined, control: null };
  }

  return {
    value,
    control: <SegmentedControl value={value} onChange={setValue} data={options} />
  };
}
