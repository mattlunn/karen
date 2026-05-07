import React, { useEffect, useRef, useState } from 'react';
import { Center, Loader, SimpleGrid, Title } from '@mantine/core';
import nowAndSetInterval from '../helpers/now-and-set-interval';
import styles from './security.module.css';

interface Camera {
  id: number;
  name: string;
  snapshotUrl: string;
}

interface SnapshotData {
  loading: boolean;
  snapshot: string | null;
}

type SnapshotsMap = Record<number, SnapshotData>;

async function loadSnapshot(camera: Camera): Promise<string> {
  const response = await fetch(camera.snapshotUrl, {
    credentials: 'same-origin'
  });

  return URL.createObjectURL(await response.blob());
}

function useSnapshotData(cameras: Camera[]): SnapshotsMap {
  const [snapshots, setSnapshots] = useState<SnapshotsMap>({});
  const blobUrls = useRef(new Map<number, string>());

  useEffect(() => {
    const urls = blobUrls.current;

    async function refreshCamera(camera: Camera) {
      setSnapshots(prev => ({ ...prev, [camera.id]: { loading: true, snapshot: prev[camera.id]?.snapshot ?? null } }));
      try {
        const snapshot = await loadSnapshot(camera);
        const old = urls.get(camera.id);

        if (old) {
          URL.revokeObjectURL(old);
        }

        urls.set(camera.id, snapshot);
        setSnapshots(prev => ({ ...prev, [camera.id]: { loading: false, snapshot } }));
      } catch {
        setSnapshots(prev => ({ ...prev, [camera.id]: { loading: false, snapshot: prev[camera.id]?.snapshot ?? null } }));
      }
    }

    const interval = nowAndSetInterval(() => cameras.forEach(refreshCamera), 5000);
    return () => {
      clearInterval(interval);

      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, [cameras]);

  return snapshots;
}

interface SecurityProps {
  cameras?: Camera[];
}

export default function Security({ cameras = [] }: SecurityProps) {
  const snapshots = useSnapshotData(cameras);

  return (
    <SimpleGrid cols={{ base: 1, xs: 3, md: cameras.length }} className={styles.root}>
      {cameras.map((camera) => {
        const snapshot = snapshots[camera.id];
        return (
          <div key={camera.id}>
            <Title order={3} className={styles.cameraName}>{camera.name}</Title>
            {snapshot?.snapshot ? (
              <img src={snapshot.snapshot} className={styles.cameraImage}/>
            ) : (
              <Center style={{ aspectRatio: '16/9' }} className={styles.cameraImage}>
                <Loader size="md" />
              </Center>
            )}
          </div>
        );
      })}
    </SimpleGrid>
  );
}
