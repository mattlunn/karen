import React, { useEffect, useState } from 'react';
import { Center, Loader, SimpleGrid, Title } from '@mantine/core';
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

  useEffect(() => {
    setSnapshots(prev => {
      const next = { ...prev };
      let changed = false;
      for (const { id } of cameras) {
        if (!(id in next)) {
          next[id] = { loading: true, snapshot: null };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cameras]);

  useEffect(() => {
    async function loadSnapshots() {
      await Promise.all(cameras.map(async (camera) => {
        try {
          const snapshot = await loadSnapshot(camera);
          setSnapshots(prev => ({ ...prev, [camera.id]: { loading: false, snapshot } }));
        } catch {
          setSnapshots(prev => ({ ...prev, [camera.id]: { ...prev[camera.id], loading: false } }));
        }
      }));
    }

    const interval = setInterval(loadSnapshots, 5000);

    loadSnapshots();

    return () => {
      clearInterval(interval);
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
