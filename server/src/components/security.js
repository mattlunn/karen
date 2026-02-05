import React, { useEffect, useState } from 'react';
import { Center, Loader, SimpleGrid } from '@mantine/core';

async function loadSnapshot(camera) {
  const response = await fetch(camera.snapshotUrl, {
    credentials: 'same-origin'
  });

  return URL.createObjectURL(await response.blob());
}

function useSnapshotData(cameras) {
  const [ snapshots, setSnapshots ] = useState({});
  const updatedSnapshots = { ...snapshots };

  for (const { id } of cameras) {
    if (!(id in updatedSnapshots)) {
      updatedSnapshots[id] = {
        loading: true,
        snapshot: null
      };

      setSnapshots(updatedSnapshots);
    }
  }

  useEffect(() => {
    function loadSnapshots() {
      setSnapshots(snapshots => {
        const updatedSnapshots = { ...snapshots };

        cameras.forEach(async (camera) => {
          const updatedSnapshot = updatedSnapshots[camera.id];

          if (updatedSnapshot.loading === true && updatedSnapshot.snapshot !== null) {
            return;
          } else {
            updatedSnapshot.loading = true;
          }

          try {
            const snapshot = await loadSnapshot(camera);

            updatedSnapshot.loading = false;
            updatedSnapshot.snapshot = snapshot;
          } finally {
            updatedSnapshot.loading = false;
          }

          updatedSnapshots[camera.id] = updatedSnapshot;
        });

        return updatedSnapshots;
      });
    }

    const interval = setInterval(loadSnapshots, 5000);

    loadSnapshots();

    return () => {
      clearInterval(interval);
    };
  }, [ cameras ]);

  return updatedSnapshots;
}

export default function Security({ cameras = [] }) {
  const snapshots = useSnapshotData(cameras);

  return (
    <SimpleGrid cols={{ base: 1, xs: 3, md: cameras.length }} className="security">
      {cameras.map((camera) => {
        const snapshot = snapshots[camera.id];
        return (
          <div key={camera.id}>
            <h3 className="security__camera-name">{camera.name}</h3>
            {snapshot?.snapshot ? (
              <img src={snapshot.snapshot} className="security__camera-image"/>
            ) : (
              <Center style={{ aspectRatio: '16/9' }} className="security__camera-image">
                <Loader size="md" />
              </Center>
            )}
          </div>
        );
      })}
    </SimpleGrid>
  );
}
