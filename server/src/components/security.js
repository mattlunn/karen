import React, { useEffect, useState } from 'react';
import gql from 'graphql-tag';
import { useQuery } from '@apollo/client';

async function loadSnapshot(camera) {
  const url = camera.capabilities.find(x => x.__typename === 'Camera').snapshot;
  const response = await fetch(url, {
    credentials: 'same-origin'
  });

  return URL.createObjectURL(await response.blob());
}

const SECURITY_QUERY = gql`
  query GetSecurityStatus {
    getSecurityStatus {
      cameras {
        id,
        name

        capabilities {
          ...on Camera {
            snapshot
          }
        }
      }
    }
  }
`;

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

        setSnapshots(updatedSnapshots);
      });
    }

    const interval = setInterval(loadSnapshots, 5000);

    loadSnapshots();

    return () => {
      clearInterval(interval);
    };
  }, [ cameras, snapshots ]);

  return updatedSnapshots;
}

export default function Security() {
  const { data, loading } = useQuery(SECURITY_QUERY);
  const [ cameras, setCameras ] = useState([]);
  const snapshots = useSnapshotData(cameras);

  if (!loading && data.getSecurityStatus.cameras !== cameras) {
    setCameras(data.getSecurityStatus.cameras);
    return <></>;
  }
  
  return (
    <div className="security">
      <ul className="security__camera-list">
        {cameras.map((camera) => {
          return (
            <li className="security__camera" key={camera.id}>
              <h3>{camera.name}</h3>
              <img
                className="loading-spinner"
                src={snapshots[camera.id].snapshot}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}