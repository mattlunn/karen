import React, { useCallback, useEffect, useState } from 'react';
import dayjs from '../../dayjs';
import Slideshow from '../kiosk/slideshow';
import DoorbellOverlay from '../kiosk/doorbell-overlay';
import { useKioskEvents } from '../kiosk/use-kiosk-events';
import { playChime } from '../kiosk/chime';
import { kioskSecret } from '../kiosk/api';
import styles from '../kiosk/kiosk.module.css';
import type { KioskEvent } from '../../api/types';

const RING_HOLD_SECONDS = 60;
const CLOCK_TICK_SECONDS = 10;
const FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;600&display=swap';

declare global {
  interface Window {
    // Injected by Fully Kiosk Browser when its JavaScript interface is enabled.
    fully?: { turnScreenOn(): void; turnScreenOff(keepAlive: boolean): void };
  }
}

function KioskScreen() {
  const [now, setNow] = useState(() => dayjs());
  const [ring, setRing] = useState<{ eventId: number; at: string } | null>(null);
  const [isScreenWanted, setIsScreenWanted] = useState(true);
  const isScreenOn = isScreenWanted || ring !== null;

  useEffect(() => {
    const link = document.createElement('link');

    link.rel = 'stylesheet';
    link.href = FONT_STYLESHEET;
    document.head.appendChild(link);

    const timer = setInterval(() => setNow(dayjs()), CLOCK_TICK_SECONDS * 1000);

    return () => {
      clearInterval(timer);
      link.remove();
    };
  }, []);

  useEffect(() => {
    if (ring === null) {
      return;
    }

    const timer = setTimeout(() => setRing(null), RING_HOLD_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, [ring]);

  useEffect(() => {
    if (isScreenOn) {
      window.fully?.turnScreenOn();
    } else {
      // keepAlive leaves the page running with the screen off, so a ring can still wake it.
      window.fully?.turnScreenOff(true);
    }
  }, [isScreenOn]);

  const handleEvent = useCallback((event: KioskEvent) => {
    if (event.type === 'doorbell_ring') {
      playChime();
      setRing({ eventId: event.eventId, at: event.at });
    } else if (event.type === 'screen') {
      setIsScreenWanted(event.isOn);
    }
  }, []);

  useKioskEvents(handleEvent);

  return (
    <div className={styles.screen}>
      {isScreenWanted && <Slideshow now={now} />}
      {ring !== null && (
        <DoorbellOverlay key={ring.eventId} eventId={ring.eventId} at={ring.at} holdSeconds={RING_HOLD_SECONDS} onDismiss={() => setRing(null)} />
      )}
    </div>
  );
}

export default function Kiosk() {
  if (kioskSecret() === '') {
    return <div className={styles.screen}><div className={styles.message}>Add ?secret=… to the address to show the kiosk.</div></div>;
  }

  return <KioskScreen />;
}
