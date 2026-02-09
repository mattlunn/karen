import React, { ReactNode, MouseEvent, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Link } from 'react-router-dom';
import { Anchor, Modal, Title } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import ThermostatHeatMap from './thermostat-heat-map';
import classNames from 'classnames';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import IssuesIndicator from './issues-indicator';
import type { RestDeviceResponse } from '../api/types';
import type { IconClickContext } from './capabilities/registry';
import styles from './device-control.module.css';

interface DeviceControlProps {
  icon: IconDefinition;
  iconOnClick?: (ctx: IconClickContext) => void | Promise<void>;
  colorIconBackground: boolean;
  color: string;
  device: RestDeviceResponse;
  values?: ReactNode[];
  showMap?: boolean;
}

export default function DeviceControl({ icon, iconOnClick, colorIconBackground, color, device, values = [], showMap }: DeviceControlProps) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [modalContent, setModalContent] = useState<ReactNode>(null);

  const handleClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (isPending || !iconOnClick) return;

    const ctx: IconClickContext = {
      openModal: (content) => setModalContent(content),
      closeModal: () => setModalContent(null),
      queryClient,
    };

    const result = iconOnClick(ctx);
    if (result instanceof Promise) {
      setIsPending(true);
      try {
        await result;
      } finally {
        setIsPending(false);
      }
    }
  };

  return (
    <>
      <div className={styles.header}>
        <a className={classNames(styles.iconContainer, isPending && styles.iconContainerDisabled)} style={{ backgroundColor: colorIconBackground ? color + '50' : 'transparent' }} onClick={handleClick} href="#">
          <FontAwesomeIcon icon={isPending ? faSync : icon} spin={isPending} color={color} />
        </a>
        <div>
          <Title order={4} className={styles.name}><Anchor component={Link} to={`/device/${device.id}`}>{device.name}</Anchor></Title>
          <ul className={styles.values}>
            {values.map((value, idx) => <li className={styles.value} key={idx}>{value}</li>)}
            <li className={styles.value}>
              <IssuesIndicator device={device} />
            </li>
          </ul>
        </div>
      </div>
      {false && (
        <div className={styles.footer}>
          {showMap && <ThermostatHeatMap activity={[]} withHours={false} colorMask={color} />}
        </div>
      )}
      <Modal opened={!!modalContent} onClose={() => setModalContent(null)} size="md" centered>
        {modalContent}
      </Modal>
    </>
  );
}
