export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

// ハーバーサイン式
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 10) return 'すぐ近く';
  const rounded = Math.round(m / 10) * 10;
  if (rounded < 1000) return `約${rounded}m`;
  return `約${(m / 1000).toFixed(1)}km`;
}

export type WithDistance<T> = { item: T; distance: number | null };

export function sortByDistance<T extends LatLng>(items: readonly T[], here: LatLng | null): WithDistance<T>[] {
  if (!here) return items.map((item) => ({ item, distance: null }));
  return items.map((item) => ({ item, distance: distanceMeters(here, item) })).sort((x, y) => x.distance - y.distance);
}

export function directionsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=walking`;
}

export function placeUrl(p: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}
