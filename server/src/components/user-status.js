import React from 'react';
import ReactDOM from 'react-dom';
import { dayjs } from '../dayjs';
import { AWAY, HOME } from '../constants/status';
import { humanDate } from '../helpers/date';
import { Anchor, Avatar, Box, Group, LoadingOverlay, Stack, Text } from '@mantine/core';
import { useUserMutation } from '../hooks/mutations/use-user-mutations';
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
      <Anchor
        href="#"
        c="inherit"
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
      </Anchor>
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
  const { mutate: updateUser, isPending } = useUserMutation(id);

  return (
    <Group align="center" gap="xs" className="user-status">
      <Box pos="relative">
        <LoadingOverlay visible={isPending} overlayProps={{ radius: 'xl' }} loaderProps={{ size: 'sm' }} />
        <a href="#" onClick={(e) => {
          e.preventDefault();

          updateUser({
            status: status === HOME ? AWAY : HOME
          });
        }}>
          <Avatar
            src={avatar}
            size="md"
            radius="xl"
            styles={{
              root: {
                border: `1px solid ${status === AWAY ? 'red' : '#5eef00'}`,
                padding: '1px'
              }
            }}
          />
        </a>
      </Box>
      <Stack gap={0}>
        <Text>{id}</Text>
        <Text size="sm" c="dimmed">
          <StatusMessage {...props} />
        </Text>
      </Stack>
    </Group>
  );
}
