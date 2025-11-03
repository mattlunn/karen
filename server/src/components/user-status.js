import React from 'react';
import ReactDOM from 'react-dom';
import moment from 'moment';
import classNames from 'classnames';
import { AWAY, HOME } from '../constants/status';
import { humanDate } from '../helpers/date';
import { useMutation, gql } from '@apollo/client';
import EtaPicker from './modals/eta-picker';
import Modal from './modal';

const UPDATE_USER_MUTATION = gql`
  mutation($id: ID!, $status: Occupancy) {
    updateUser(id:$id, status:$status) {
      id,
      status,
      since
    }
  }
`;

function StatusMessage({ status, since, until, id }) {
  const [ showModal, setShowModal ] = React.useState(false);

  if (status === HOME) {
    const sinceMoment = moment(since);
    return `since ${sinceMoment.format('HH:mm')} ${humanDate(sinceMoment)}`;
  } else {
    const untilMoment = until ? moment(until) : null;
    const untilMessage = (
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setShowModal(true);
        }}
      >
        {untilMoment ? (
          <>
            {untilMoment.format('HH:mm')}
            &nbsp;
            {humanDate(untilMoment)}
          </>
        ) : (
          'unknown'
        )}
      </a>
    );

    return (
      <>
        until {untilMessage}

        {showModal && ReactDOM.createPortal(
          <Modal>
            <EtaPicker id={id} eta={untilMoment} closeModal={() => setShowModal(false)} />
          </Modal>,
          
          document.body)
        }
      </>
    );
  }
}

export default function UserStatus(props) {
  const { status, id, avatar } = props;
  const [updateUser] = useMutation(UPDATE_USER_MUTATION);

  return (
    <div className="user-status">
      <a href="#" onClick={(e) => {
        e.preventDefault();

        updateUser({
          variables: {
            id,
            status: status === HOME ? AWAY : HOME
          }
        });
      }}>
        <img
          className={classNames('user-status__avatar', {
            'user-status__avatar--away': status === AWAY
          })}
          src={avatar}
        />
      </a>
      <div>
        <h3 className="user-status__user-name">{id}</h3>
        <p className="user-status__about">
          <StatusMessage {...props} />
        </p>
      </div>
    </div>
  );
}