import React, { useState } from 'react';
import dayjs from '../../dayjs';
import { kioskUrl } from './api';
import styles from './kiosk.module.css';

const SNAPSHOT_RETRY_MS = 700;
const SNAPSHOT_MAX_ATTEMPTS = 20;

interface DoorbellOverlayProps {
  eventId: number;
  at: string;
  holdSeconds: number;
  onDismiss: () => void;
}

export default function DoorbellOverlay({ eventId, at, holdSeconds, onDismiss }: DoorbellOverlayProps) {
  const [attempt, setAttempt] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const retry = () => {
    if (attempt < SNAPSHOT_MAX_ATTEMPTS) {
      setTimeout(() => setAttempt((previous) => previous + 1), SNAPSHOT_RETRY_MS);
    }
  };

  return (
    <button type="button" className={styles.ring} onClick={onDismiss}>
      <img
        className={isLoaded ? styles.snapshot : `${styles.snapshot} ${styles.snapshotPending}`}
        src={kioskUrl(`/rings/${eventId}.jpg`, { attempt })}
        onLoad={() => setIsLoaded(true)}
        onError={retry}
        alt="Doorbell camera snapshot"
      />
      {!isLoaded && <div className={styles.ringNote}>Fetching snapshot…</div>}
      <div className={styles.ringBar}>
        <span className={styles.ringTitle}>Someone&rsquo;s at the door</span>
        <span className={styles.ringTime}>{dayjs(at).format('HH:mm')}</span>
      </div>
      <div className={styles.countdown}>
        <i className={styles.countdownBar} style={{ animationDuration: `${holdSeconds}s` }} />
      </div>
    </button>
  );
}
