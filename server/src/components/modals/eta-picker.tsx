import React, { useState } from 'react';
import { DatePicker } from '@mantine/dates';
import { Button } from '@mantine/core';
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

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'hour') {
      setSelectedDate(selectedDate.hour(Number(value)));
    } else if (name === 'minute') {
      setSelectedDate(selectedDate.minute(Number(value)));
    }
  };

  const handleSetEta = () => {
    updateUser({ eta: +selectedDate }, {
      onSuccess: () => closeModal()
    });
  };

  return (
    <div className="eta-picker">
      <div className="eta-picker__body">
        <h2>When will <strong>{id}</strong> be home?</h2>

        <div>
          <DatePicker
            value={selectedDate.toDate()}
            onChange={handleDateChange}
            minDate={new Date()}
            size="md"
          />
        </div>
        <div className="eta-picker__selected-date-and-time">
          <div className="eta-picker__selected-date">
            {selectedDate.format('DD/MM/YYYY')}
          </div>
          <div className="eta-picker__selected-time">
            at&nbsp;
            <select onChange={handleSelectChange} name="hour" value={selectedDate.hour()}>
              {Array.from(range(0, 24)).map(x => <option value={x} key={x}>{pad(x)}</option>)}
            </select>
            :
            <select onChange={handleSelectChange} name="minute" value={selectedDate.minute()}>
              {Array.from(range(0, 60, 15)).map(x => <option value={x} key={x}>{pad(x)}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="eta-picker__footer">
        <Button variant="default" onClick={closeModal} mr="sm">Cancel</Button>
        <Button loading={isPending} onClick={handleSetEta}>Ok</Button>
      </div>
    </div>
  );
}
