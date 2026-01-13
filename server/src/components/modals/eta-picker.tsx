import React, { useState } from 'react';
import { DateTimePicker } from '@mantine/dates';
import { useMutation, gql } from '@apollo/client';
import dayjs, { Dayjs } from '../../dayjs';

const UPDATE_USER_MUTATION = gql`
  mutation($id: ID!, $eta: Float) {
    updateUser(id: $id, eta: $eta) {
      id,
      until
    }
  }
`;

interface EtaPickerProps {
  id: string;
  eta: Dayjs | null;
  closeModal: () => void;
}

export default function EtaPicker({ id, eta, closeModal }: EtaPickerProps) {
  const [date, setDate] = useState<Date | null>(eta ? eta.toDate() : null);
  const [updateUser] = useMutation(UPDATE_USER_MUTATION);

  const handleSetEta = () => {
    if (date) {
      updateUser({
        variables: {
          id,
          eta: +dayjs(date)
        }
      }).then(() => {
        closeModal();
      });
    }
  };

  return (
    <div className="eta-picker">
      <div className="eta-picker__body">
        <h2>When will <strong>{id}</strong> be home?</h2>

        <DateTimePicker
          value={date}
          onChange={setDate}
          minDate={new Date()}
          valueFormat="DD/MM/YYYY HH:mm"
          size="md"
        />
      </div>
      <div className="eta-picker__footer">
        <button className="secondary" onClick={closeModal}>Cancel</button>
        <button className="primary" onClick={handleSetEta}>Ok</button>
      </div>
    </div>
  );
}
