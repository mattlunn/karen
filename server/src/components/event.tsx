import React, { ReactNode, useState } from 'react';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';

type EventProps = {
  renderControls?: (args: { openPanel: (panel: string) => void; closePanel: () => void; togglePanel: (panel: string) => void; }) => React.ReactNode[];
  timestamp: string;
  icon: IconProp;
  title: ReactNode;
  panels: Record<string, ReactNode>;
};

export default function Event({ renderControls, timestamp, icon, title, panels }: EventProps) {
  const [panel, setPanel] = useState<string | null>(null);
  const controlsRender = () => {
    if (!renderControls) return null;

    const controlComponnets = renderControls({
      openPanel(p) {
        setPanel(p)
      },

      closePanel() {
        setPanel(null);
      }, 

      togglePanel(p) {
        setPanel(prev => (prev === p ? null : p));
      }
    });

    return (
      <span className="event__buttons">
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
      <span className="event__timestamp">{moment(timestamp).format('HH:mm:ss')}</span>
      <span className="event__icon"><FontAwesomeIcon icon={icon} /></span>

      {title}

      {controlsRender()}

      {panel && (
        <div className="event__panel">
          {panels[panel]}
        </div>
      )}
    </>
  );
}