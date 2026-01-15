import React, { useState } from 'react';
import { DatePicker } from '@mantine/dates';
import dayjs, { Dayjs } from '../../dayjs';
import { range } from '../../helpers/iterable';
import useApiMutation from '../../hooks/api-mutation';

interface EtaPickerProps {
  id: string;
  eta: Dayjs | null;
  closeModal: () => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function EtaPicker({ id, eta, closeModal }: EtaPickerProps) {
  const [date, setDate] = useState<Dayjs>(eta ?? dayjs().startOf('day'));
  const { mutate: updateUser } = useApiMutation(`/user/${id}`);

  const handleDateChange = (value: Date | null) => {
    if (value) {
      setDate(dayjs(value).hour(date.hour()).minute(date.minute()));
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'hour') {
      setDate(date.hour(Number(value)));
    } else if (name === 'minute') {
      setDate(date.minute(Number(value)));
    }
  };

  const handleSetEta = () => {
    updateUser({
      eta: +date
    }).then(() => {
      closeModal();
    });
  };

  return (
    <div className="eta-picker">
      <div className="eta-picker__body">
        <h2>When will <strong>{id}</strong> be home?</h2>

        <div>
          <DatePicker
            value={date.toDate()}
            onChange={handleDateChange}
            minDate={new Date()}
            size="md"
          />
        </div>
        <div className="eta-picker__selected-date-and-time">
          <div className="eta-picker__selected-date">
            {date.format('DD/MM/YYYY')}
          </div>
          <div className="eta-picker__selected-time">
            at&nbsp;
            <select onChange={handleSelectChange} name="hour" value={date.hour()}>
              {Array.from(range(0, 24)).map(x => <option value={x} key={x}>{pad(x)}</option>)}
            </select>
            :
            <select onChange={handleSelectChange} name="minute" value={date.minute()}>
              {Array.from(range(0, 60, 15)).map(x => <option value={x} key={x}>{pad(x)}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="eta-picker__footer">
        <button className="secondary" onClick={closeModal}>Cancel</button>
        <button className="primary" onClick={handleSetEta}>Ok</button>
      </div>
    </div>
  );
}
