import React from 'react';
import { useBuildVersion } from './build-version-context';
import styles from './footer.module.css';

export default function Footer() {
  const version = useBuildVersion();

  if (!version) {
    return null;
  }

  return <div className={styles.footer}>v{version}</div>;
}
