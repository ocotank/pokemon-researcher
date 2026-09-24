import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type StatuePhoto = { statueId: string; blob: Blob; takenAt: number };
export type Panel = {
  id: string;
  blob: Blob;
  name: string;
  memo: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  takenAt: number;
};
export type StatueName = { statueId: string; name: string };
export type SpotOverride = { spotId: string; lat: number; lng: number };

interface Schema extends DBSchema {
  statuePhotos: { key: string; value: StatuePhoto };
  panels: { key: string; value: Panel };
  statueNames: { key: string; value: StatueName };
  spotOverrides: { key: string; value: SpotOverride };
}

const DB_NAME = 'legend-research';
let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('statuePhotos', { keyPath: 'statueId' });
      d.createObjectStore('panels', { keyPath: 'id' });
      d.createObjectStore('statueNames', { keyPath: 'statueId' });
      d.createObjectStore('spotOverrides', { keyPath: 'spotId' });
    },
  });
  return dbPromise;
}

export async function resetDatabase(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await deleteDB(DB_NAME);
}

export async function putStatuePhoto(v: StatuePhoto): Promise<void> {
  await (await db()).put('statuePhotos', v);
}
export async function getAllStatuePhotos(): Promise<StatuePhoto[]> {
  return (await db()).getAll('statuePhotos');
}
export async function deleteStatuePhoto(statueId: string): Promise<void> {
  await (await db()).delete('statuePhotos', statueId);
}

export async function putPanel(v: Panel): Promise<void> {
  await (await db()).put('panels', v);
}
export async function getAllPanels(): Promise<Panel[]> {
  const all = await (await db()).getAll('panels');
  return all.sort((a, b) => b.takenAt - a.takenAt);
}
export async function deletePanel(id: string): Promise<void> {
  await (await db()).delete('panels', id);
}

export async function putStatueName(v: StatueName): Promise<void> {
  await (await db()).put('statueNames', v);
}
export async function getAllStatueNames(): Promise<StatueName[]> {
  return (await db()).getAll('statueNames');
}
export async function deleteStatueName(statueId: string): Promise<void> {
  await (await db()).delete('statueNames', statueId);
}

export async function putSpotOverride(v: SpotOverride): Promise<void> {
  await (await db()).put('spotOverrides', v);
}
export async function getAllSpotOverrides(): Promise<SpotOverride[]> {
  return (await db()).getAll('spotOverrides');
}
export async function deleteSpotOverride(spotId: string): Promise<void> {
  await (await db()).delete('spotOverrides', spotId);
}
