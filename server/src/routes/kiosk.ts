import express from 'express';
import config from '../config';
import dayjs, { Dayjs } from '../dayjs';
import { Device, Event } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import s3 from '../services/s3';
import { getAlbums, getAlbumImages, getPreview, type ImmichAsset } from '../services/immich';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { BUILD_VERSION } from '../helpers/build-version';
import type { KioskEvent, KioskPhoto, KioskRandomPhotoApiResponse } from '../api/types';

const router = express.Router();
const eventStreams = new Set<express.Response>();
interface PhotoPools {
  withPeople: KioskPhoto[];
  withoutPeople: KioskPhoto[];
}

let albumCache: { fetchedAt: Dayjs; photos: Promise<PhotoPools> } | null = null;

export function toKioskPhoto(asset: ImmichAsset, albumName: string, hiddenPeople: readonly string[]): KioskPhoto {
  const firstNames = (asset.people ?? [])
    .filter((person) => person.name !== '' && !hiddenPeople.includes(person.name))
    .map((person) => person.name.split(' ')[0])
    .sort();

  return {
    id: asset.id,
    // Immich encodes the wall-clock time where the photo was taken with a misleading Z suffix.
    takenAtLocal: asset.localDateTime.replace(/(\.\d+)?Z$/, ''),
    people: [...new Set(firstNames)],
    city: asset.exifInfo?.city ?? null,
    description: asset.exifInfo?.description || null,
    albumName
  };
}

export function hasNamedPerson(asset: ImmichAsset): boolean {
  return (asset.people ?? []).some((person) => person.name !== '');
}

export function pickRandomPhoto({ withPeople, withoutPeople }: PhotoPools, photosWithoutPeoplePercent: number, random = Math.random): KioskPhoto | null {
  const pool = withPeople.length === 0 || (withoutPeople.length > 0 && random() * 100 < photosWithoutPeoplePercent)
    ? withoutPeople
    : withPeople;

  return pool.length === 0 ? null : pool[Math.floor(random() * pool.length)];
}

async function loadAlbumPhotos(): Promise<PhotoPools> {
  // Smallest first, so a photo that's in several albums is labelled with the most specific one.
  const albums = (await getAlbums())
    .filter((album) => !config.kiosk.immich_excluded_album_ids.includes(album.id))
    .sort((a, b) => a.assetCount - b.assetCount);

  const albumAssets = await Promise.all(albums.map((album) => getAlbumImages(album.id)));
  const seenIds = new Set<string>();
  const pools: PhotoPools = { withPeople: [], withoutPeople: [] };

  albums.forEach((album, i) => {
    for (const asset of albumAssets[i]) {
      if (seenIds.has(asset.id)) {
        continue;
      }

      const photo = toKioskPhoto(asset, album.albumName, config.kiosk.hidden_people);

      seenIds.add(asset.id);

      if (hasNamedPerson(asset)) {
        pools.withPeople.push(photo);
      } else {
        pools.withoutPeople.push(photo);
      }
    }
  });

  return pools;
}

// Caching the promise means requests that arrive mid-load share it, rather than each reloading every album.
function getAlbumPhotos(): Promise<PhotoPools> {
  if (albumCache === null || dayjs().diff(albumCache.fetchedAt, 'minute') >= config.kiosk.album_cache_minutes) {
    const photos = loadAlbumPhotos();

    albumCache = { fetchedAt: dayjs(), photos };

    photos.catch(() => {
      if (albumCache?.photos === photos) {
        albumCache = null;
      }
    });
  }

  return albumCache.photos;
}

function send(stream: express.Response, message: KioskEvent) {
  stream.write(`data: ${JSON.stringify(message)}\n\n`);
}

async function isWakeLightOn(): Promise<boolean> {
  const device = await Device.findByNameOrError(config.kiosk.wake_light_name);

  return await device.getLightCapability().getIsOn();
}

const isWakeLight = (device: Device) => device.name === config.kiosk.wake_light_name;

const broadcastScreenState = createBackgroundTransaction('kiosk:screen-state', async () => {
  const isOn = await isWakeLightOn();

  for (const stream of eventStreams) {
    send(stream, { type: 'screen', isOn });
  }
});

DeviceCapabilityEvents.onLightIsOnChanged(isWakeLight, broadcastScreenState);

DeviceCapabilityEvents.onDoorbellRing((event) => {
  for (const stream of eventStreams) {
    send(stream, { type: 'doorbell_ring', eventId: event.id, at: event.start.toISOString() });
  }
});

router.use((req, res, next) => {
  if (req.query.secret !== config.kiosk.secret) {
    res.sendStatus(401);

    return;
  }

  next();
});

router.get<Record<string, never>, KioskRandomPhotoApiResponse>('/photos/random', async (req, res) => {
  const photo = pickRandomPhoto(await getAlbumPhotos(), config.kiosk.photos_without_people_percent);

  if (photo === null) {
    res.sendStatus(404);

    return;
  }

  const { contentType, body } = await getPreview(photo.id);

  res.set('Cache-Control', 'no-store');
  res.json({ photo, imageDataUrl: `data:${contentType};base64,${body.toString('base64')}` });
});

router.get('/rings/:eventId.jpg', async (req, res) => {
  const event = await Event.findByPk(req.params.eventId);

  if (event === null || event.type !== 'ring') {
    res.sendStatus(404);

    return;
  }

  let snapshot: Buffer;

  // The snapshot is stored a second or so after the ring is recorded, so the page retries until it's there.
  try {
    snapshot = await s3.serve(String(event.id), null, null);
  } catch {
    res.sendStatus(404);

    return;
  }

  res.set('Cache-Control', 'private, max-age=86400');
  res.type('jpeg').send(snapshot);
});

router.get('/events', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });

  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventStreams.delete(res);
  });

  eventStreams.add(res);
  send(res, { type: 'connected', buildVersion: BUILD_VERSION });
  send(res, { type: 'screen', isOn: await isWakeLightOn() });
});

export default router;
