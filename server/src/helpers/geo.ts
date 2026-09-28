export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METRES = 6371000;

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function distanceInMetres(a: Coordinates, b: Coordinates): number {
  const dLatitude = toRadians(b.latitude - a.latitude);
  const dLongitude = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLatitude / 2) ** 2
    + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(h));
}
