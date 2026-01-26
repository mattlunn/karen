import React, { useEffect, useState } from 'react';

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
        loading: false,
        snapshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAQAAACRI2S5AAAAEElEQVR42mNkIAAYRxWAAQAG9gAKqv6+AwAAAABJRU5ErkJggg=='
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

          if (updatedSnapshot.loading === true) {
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
    <div className="security">
      <ul className="security__camera-list">
        {cameras.map((camera) => {
          const snapshot = snapshots[camera.id];
          return (
            <li className="security__camera" key={camera.id}>
              <h3>{camera.name}</h3>
              <img
                className="loading-spinner"
                src={snapshot?.snapshot}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}