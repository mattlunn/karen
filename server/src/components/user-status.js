import React from 'react';
import ReactDOM from 'react-dom';
import dayjs from '../dayjs';
import classNames from 'classnames';
import { AWAY, HOME } from '../constants/status';
import { humanDate } from '../helpers/date';
import useApiMutation from '../hooks/api-mutation';
import EtaPicker from './modals/eta-picker';
import Modal from './modal';

function StatusMessage({ status, since, until, id }) {
  const [ showModal, setShowModal ] = React.useState(false);

  if (status === HOME) {
    const sinceMoment = dayjs(since);
    return `since ${sinceMoment.format('HH:mm')} ${humanDate(sinceMoment)}`;
  } else {
    const untilMoment = until ? dayjs(until) : null;
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
  const { mutate: updateUser } = useApiMutation(`/users/${id}`);

  return (
    <div className="user-status">
      <a href="#" onClick={(e) => {
        e.preventDefault();

        updateUser({
          status: status === HOME ? AWAY : HOME
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