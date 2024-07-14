import moment from 'moment';

export default function getTimetabledTemperature(timetable, time) {
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

  const dayTypes = getDayTypes();
  const matchingBlock = timetable.find(block => {
    if (!dayTypes.includes(block.dayType)) {
      return false;
    }

    const blockEnd = moment(block.end, 'HH:mm');

    if (block.end === '00:00') {
      blockEnd.add(1, 'd');
    }

    return moment(block.start, 'HH:mm').isSameOrBefore(time) && blockEnd.isAfter(time);
  });

  if (matchingBlock.setting.power === 'ON') {
    return matchingBlock.setting.temperature.celsius;
  }

  return null;
}