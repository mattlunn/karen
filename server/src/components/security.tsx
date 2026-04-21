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

  // Initialise entries for cameras not yet tracked. React discards this render and
  // immediately re-renders with the updated state (setState-during-render pattern).
  const uninitialized = cameras.filter(({ id }) => !(id in snapshots));
  if (uninitialized.length > 0) {
    setSnapshots(prev => ({
      ...prev,
      ...Object.fromEntries(
        uninitialized.map(({ id }) => [id, { loading: true, snapshot: null } as SnapshotData])
      ),
    }));
  }

  useEffect(() => {
    async function loadCameraSnapshot(camera: Camera) {
      try {
        const snapshot = await loadSnapshot(camera);
        setSnapshots(prev => ({ ...prev, [camera.id]: { loading: false, snapshot } }));
      } catch {
        setSnapshots(prev => ({ ...prev, [camera.id]: { ...prev[camera.id], loading: false } }));
      }
    }

    function loadAll() {
      cameras.forEach(camera => loadCameraSnapshot(camera));
    }

    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
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
