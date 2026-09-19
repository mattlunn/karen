import React, { ReactNode, useState } from 'react';
import { Checkbox, Group, Title } from '@mantine/core';
import { useDateRange, DateRangeSelector, getPresetRange } from './date-range';
import { DateRange, DateRangePreset } from './date-range/types';
import { usePillToggle, PillOption } from './pill-toggle';

export type GraphChromeContext = {
  since: string;
  until: string;
  range: DateRange;
  setRange: (range: DateRange) => void;
  preset: DateRangePreset;
  isLinkedToPageRange: boolean;
  activeGraphId: string | undefined;
};

type GraphChromeProps = {
  title: string;
  // Rendered right of the title when a graph offers several views of itself.
  pills?: PillOption[];
  // The range used while unlinked from the page range.
  localPreset?: DateRangePreset;
  localRange?: DateRange;
  linkedToPageRangeByDefault?: boolean;
  children: (context: GraphChromeContext) => ReactNode;
};

export function GraphChrome({
  title,
  pills,
  localPreset,
  localRange: initialLocalRange,
  linkedToPageRangeByDefault,
  children
}: GraphChromeProps) {
  const { globalRange } = useDateRange();
  const [isLinkedToPageRange, setIsLinkedToPageRange] = useState(linkedToPageRangeByDefault ?? !localPreset);
  const [preset, setPreset] = useState<DateRangePreset>(localPreset ?? 'last6hours');
  const [localRange, setLocalRange] = useState<DateRange | null>(
    () => initialLocalRange ?? (localPreset ? getPresetRange(localPreset) : null)
  );
  const { value: activeGraphId, control } = usePillToggle(pills);

  const effectiveRange = isLinkedToPageRange ? globalRange : (localRange ?? globalRange);

  const handleLinkChange = (checked: boolean) => {
    if (!checked && !localRange) {
      setLocalRange(globalRange);
    }
    setIsLinkedToPageRange(checked);
  };

  return (
    <div className="device-graph">
      <Group justify="space-between" className="device-graph__controls" mt="lg">
        <Title order={4}>{title}</Title>
        <div style={{ marginLeft: 'auto' }}>{control}</div>
      </Group>

      <Group justify="flex-end" gap="sm" mt="sm">
        {!isLinkedToPageRange && localRange && (
          <DateRangeSelector
            preset={preset}
            range={localRange}
            onPresetChange={setPreset}
            onRangeChange={setLocalRange}
          />
        )}

        <Checkbox
          label="Use page date range"
          checked={isLinkedToPageRange}
          onChange={(e) => handleLinkChange(e.currentTarget.checked)}
        />
      </Group>

      {children({
        since: effectiveRange.since.toISOString(),
        until: effectiveRange.until.toISOString(),
        range: effectiveRange,
        setRange: setLocalRange,
        preset,
        isLinkedToPageRange,
        activeGraphId
      })}
    </div>
  );
}
