import express from 'express';
import config from '../config';
import dayjs, { Dayjs } from '../dayjs';
import { Device, Event } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import s3 from '../services/s3';
import { getAlbums, getAlbumImages, getPreview, type ImmichAsset } from '../services/immich';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { BUILD_VERSION } from '../helpers/build-version';
import type { KioskEvent, KioskPhoto, KioskPhotosApiResponse } from '../api/types';

const ALBUM_CACHE_MINUTES = 10;

const router = express.Router();
const eventStreams = new Set<express.Response>();
let albumCache: { fetchedAt: Dayjs; photosById: Promise<Map<string, KioskPhoto>> } | null = null;

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

async function loadAlbumPhotos(): Promise<Map<string, KioskPhoto>> {
  // Smallest first, so a photo that's in several albums is labelled with the most specific one.
  const albums = (await getAlbums())
    .filter((album) => !config.kiosk.immich_excluded_album_ids.includes(album.id))
    .sort((a, b) => a.assetCount - b.assetCount);

  const albumAssets = await Promise.all(albums.map((album) => getAlbumImages(album.id)));
  const photosById = new Map<string, KioskPhoto>();

  albums.forEach((album, i) => {
    for (const asset of albumAssets[i]) {
      if (!photosById.has(asset.id)) {
        photosById.set(asset.id, toKioskPhoto(asset, album.albumName, config.kiosk.hidden_people));
      }
    }
  });

  return photosById;
}

// Caching the promise means requests that arrive mid-load share it, rather than each reloading every album.
function getAlbumPhotos(): Promise<Map<string, KioskPhoto>> {
  if (albumCache === null || dayjs().diff(albumCache.fetchedAt, 'minute') >= ALBUM_CACHE_MINUTES) {
    const photosById = loadAlbumPhotos();

    albumCache = { fetchedAt: dayjs(), photosById };

    photosById.catch(() => {
      if (albumCache?.photosById === photosById) {
        albumCache = null;
      }
    });
  }

  return albumCache.photosById;
}

function send(stream: express.Response, message: KioskEvent) {
  stream.write(`data: ${JSON.stringify(message)}\n\n`);
}

async function isAnyWakeLightOn(): Promise<boolean> {
  const devices = await Promise.all(config.kiosk.wake_light_names.map((name) => Device.findByNameOrError(name)));
  const states = await Promise.all(devices.map((device) => device.getCapabilities().includes('LIGHT')
    ? device.getLightCapability().getIsOn()
    : device.getSwitchCapability().getIsOn()));

  return states.includes(true);
}

const isWakeLight = (device: Device) => config.kiosk.wake_light_names.includes(device.name);

const broadcastScreenState = createBackgroundTransaction('kiosk:screen-state', async () => {
  const isOn = await isAnyWakeLightOn();

  for (const stream of eventStreams) {
    send(stream, { type: 'screen', isOn });
  }
});

DeviceCapabilityEvents.onLightIsOnChanged(isWakeLight, broadcastScreenState);
DeviceCapabilityEvents.onSwitchIsOnChanged(isWakeLight, broadcastScreenState);

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

router.get<Record<string, never>, KioskPhotosApiResponse>('/photos', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json({ photos: [...(await getAlbumPhotos()).values()] });
});

router.get('/photos/:id.jpg', async (req, res) => {
  if (!(await getAlbumPhotos()).has(req.params.id)) {
    res.sendStatus(404);

    return;
  }

  const { contentType, body } = await getPreview(req.params.id);

  res.set('Cache-Control', 'private, max-age=86400');
  res.type(contentType).send(body);
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
  send(res, { type: 'screen', isOn: await isAnyWakeLightOn() });
});

export default router;
