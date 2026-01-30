import dayjs, { Dayjs } from '../../../dayjs';
import { ZoneTimetableBlock } from '../client';

export default function getTimetabledTemperature(timetable: ZoneTimetableBlock[], time: Dayjs): number | null {
  function getDayTypes() {
    switch (time.day()) {
      case 0:
        return ['SUNDAY', 'MONDAY_TO_SUNDAY'];
      case 1:
        return ['MONDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
      case 2:
        return ['TUESDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
      case 3:
        return ['WEDNESDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
      case 4:
        return ['THURSDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
      case 5:
        return ['FRIDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
      case 6:
        return ['SATURDAY', 'MONDAY_TO_SUNDAY'];
    }
  }

  function adjustToTime(hhMM: string) {
    const date = dayjs(time);
    const [hours, minutes] = hhMM.split(':').map(Number);

    return date.set('hour', hours).set('minute', minutes).set('second', 0).set('millisecond', 0);
  }

  const dayTypes = getDayTypes();
  const matchingBlock = timetable.find(block => {
    if (!dayTypes.includes(block.dayType)) {
      return false;
    }

    let blockEnd = adjustToTime(block.end);

    if (block.end === '00:00') {
      blockEnd = blockEnd.add(1, 'd');
    }

    return adjustToTime(block.start).isSameOrBefore(time) && blockEnd.isAfter(time);
  });

  if (matchingBlock === undefined) {
    throw new Error(`No matching timetable block found for ${time}, with timetable ${JSON.stringify(timetable)}`);
  }

  if (matchingBlock.setting.power === 'ON') {
    return matchingBlock.setting.temperature.celsius;
  }

  return null;
}
