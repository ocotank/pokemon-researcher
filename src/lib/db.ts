import { type DBSchema, deleteDB, type IDBPDatabase, openDB, type StoreNames } from 'idb';

export type StatuePhoto = { statueId: string; blob: Blob; thumb?: Blob; takenAt: number };
export type Panel = {
  id: string;
  blob: Blob;
  thumb?: Blob;
  name: string;
  memo: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  takenAt: number;
};
export type SpotPhoto = { spotId: string; blob: Blob; thumb?: Blob; takenAt: number };
export type StatueName = { statueId: string; name: string };
export type SpotOverride = { spotId: string; lat: number; lng: number };

interface Schema extends DBSchema {
  statuePhotos: { key: string; value: StatuePhoto };
  spotPhotos: { key: string; value: SpotPhoto };
  panels: { key: string; value: Panel };
  statueNames: { key: string; value: StatueName };
  spotOverrides: { key: string; value: SpotOverride };
}

const DB_NAME = 'legend-research';
let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, 2, {
    upgrade(d) {
      const create = (name: StoreNames<Schema>, keyPath: string) => {
        if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath });
      };
      create('statuePhotos', 'statueId');
      create('panels', 'id');
      create('statueNames', 'statueId');
      create('spotOverrides', 'spotId');
      create('spotPhotos', 'spotId');
    },
    terminated() {
      dbPromise = null;
    },
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function isRecoverableDBError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'InvalidStateError' || error.name === 'UnknownError');
}

async function withDB<T>(fn: (d: IDBPDatabase<Schema>) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const connection = await db();
    try {
      return await fn(connection);
    } catch (error) {
      if (attempt === 0 && isRecoverableDBError(error)) {
        dbPromise = null;
        continue;
      }
      throw error;
    }
  }
  throw new Error('データベースを操作できませんでした');
}

export async function resetDatabase(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await deleteDB(DB_NAME);
}

export async function closeConnectionForTests(): Promise<void> {
  (await dbPromise)?.close();
}

export async function putStatuePhoto(v: StatuePhoto): Promise<void> {
  await withDB((d) => d.put('statuePhotos', v));
}
export async function getAllStatuePhotos(): Promise<StatuePhoto[]> {
  return withDB((d) => d.getAll('statuePhotos'));
}
export async function deleteStatuePhoto(statueId: string): Promise<void> {
  await withDB((d) => d.delete('statuePhotos', statueId));
}

export async function putSpotPhoto(v: SpotPhoto): Promise<void> {
  await withDB((d) => d.put('spotPhotos', v));
}
export async function getAllSpotPhotos(): Promise<SpotPhoto[]> {
  return withDB((d) => d.getAll('spotPhotos'));
}
export async function deleteSpotPhoto(spotId: string): Promise<void> {
  await withDB((d) => d.delete('spotPhotos', spotId));
}

export async function putPanel(v: Panel): Promise<void> {
  await withDB((d) => d.put('panels', v));
}
export async function getAllPanels(): Promise<Panel[]> {
  const all = await withDB((d) => d.getAll('panels'));
  return all.sort((a, b) => b.takenAt - a.takenAt);
}
export async function deletePanel(id: string): Promise<void> {
  await withDB((d) => d.delete('panels', id));
}

export async function putStatueName(v: StatueName): Promise<void> {
  await withDB((d) => d.put('statueNames', v));
}
export async function getAllStatueNames(): Promise<StatueName[]> {
  return withDB((d) => d.getAll('statueNames'));
}
export async function deleteStatueName(statueId: string): Promise<void> {
  await withDB((d) => d.delete('statueNames', statueId));
}

export async function putSpotOverride(v: SpotOverride): Promise<void> {
  await withDB((d) => d.put('spotOverrides', v));
}
export async function getAllSpotOverrides(): Promise<SpotOverride[]> {
  return withDB((d) => d.getAll('spotOverrides'));
}
export async function deleteSpotOverride(spotId: string): Promise<void> {
  await withDB((d) => d.delete('spotOverrides', spotId));
}
