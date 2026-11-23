import type { KioskPhoto } from '../api/types';
import type { ImmichAsset } from '../services/immich';

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
