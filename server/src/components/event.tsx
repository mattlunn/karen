import React, { ReactNode, useState } from 'react';
import dayjs from '../dayjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import styles from './pages/timeline.module.css';

type EventProps = {
  timestamp: string;
  icon: IconProp;
  iconColor?: string;
  title: ReactNode;
  renderControls?: (args: { openPanel: (panel: string) => void; closePanel: () => void; togglePanel: (panel: string) => void; }) => React.ReactNode[];
  panels?: Record<string, ReactNode>;
};

export default function Event({ renderControls, timestamp, icon, title, panels, iconColor }: EventProps) {
  const [panel, setPanel] = useState<string | null>(null);
  const controlsRender = () => {
    if (!renderControls) return null;

    const controlComponnets = renderControls({
      openPanel(p) {
        setPanel(p);
      },

      closePanel() {
        setPanel(null);
      }, 

      togglePanel(p) {
        setPanel(prev => (prev === p ? null : p));
      }
    });

    return (
      <span className={styles.eventButtons}>
        {controlComponnets.map((control, idx) => (
          <React.Fragment key={idx}>
            {idx !== 0 && <>&nbsp;&bull;&nbsp;</>}
            {control}
          </React.Fragment>
        ))}
      </span>
    );
  };

  return (
    <>
      <span className={styles.eventTimestamp}>{dayjs(timestamp).format('HH:mm:ss')}</span>
      <span className={styles.eventIcon}><FontAwesomeIcon icon={icon} color={iconColor} /></span>

      {title}

      {controlsRender()}

      {panels && panel && (
        <div className={styles.eventPanel}>
          {panels[panel]}
        </div>
      )}
    </>
  );
}