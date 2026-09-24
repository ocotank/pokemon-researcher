import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  getAllPanels,
  getAllSpotOverrides,
  getAllStatueNames,
  getAllStatuePhotos,
  putPanel,
  putSpotOverride,
  putStatueName,
  putStatuePhoto,
  type Panel,
  type SpotOverride,
  type StatueName,
  type StatuePhoto,
} from './db';

export type BackupData = {
  statuePhotos: StatuePhoto[];
  panels: Panel[];
  statueNames: StatueName[];
  spotOverrides: SpotOverride[];
};

type Manifest = {
  version: 1;
  exportedAt: number;
  statuePhotos: (Omit<StatuePhoto, 'blob'> & { file: string })[];
  panels: (Omit<Panel, 'blob'> & { file: string })[];
  statueNames: StatueName[];
  spotOverrides: SpotOverride[];
};

const toBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const toBlob = (u8: Uint8Array, type: string) => new Blob([u8 as Uint8Array<ArrayBuffer>], { type });

export async function buildBackupZip(d: BackupData, now = Date.now()): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const manifest: Manifest = {
    version: 1,
    exportedAt: now,
    statuePhotos: [],
    panels: [],
    statueNames: d.statueNames,
    spotOverrides: d.spotOverrides,
  };
  for (const { blob, ...rest } of d.statuePhotos) {
    const file = `photos/statue-${rest.statueId}.jpg`;
    files[file] = await toBytes(blob);
    manifest.statuePhotos.push({ ...rest, file });
  }
  for (const { blob, ...rest } of d.panels) {
    const file = `photos/panel-${rest.id}.jpg`;
    files[file] = await toBytes(blob);
    manifest.panels.push({ ...rest, file });
  }
  files['data.json'] = strToU8(JSON.stringify(manifest));
  // JPEG は圧縮済みなので無圧縮で格納
  return zipSync(files, { level: 0 });
}

export function parseBackupZip(zip: Uint8Array): BackupData {
  const files = unzipSync(zip);
  const raw = files['data.json'];
  if (!raw) throw new Error('data.json が見つかりません');
  const m = JSON.parse(strFromU8(raw)) as Manifest;
  if (m.version !== 1) throw new Error(`未対応のバックアップ形式です（version ${m.version}）`);
  const photo = (file: string) => {
    const bytes = files[file];
    if (!bytes) throw new Error(`${file} が見つかりません`);
    return toBlob(bytes, 'image/jpeg');
  };
  return {
    statuePhotos: m.statuePhotos.map(({ file, ...rest }) => ({ ...rest, blob: photo(file) })),
    panels: m.panels.map(({ file, ...rest }) => ({ ...rest, blob: photo(file) })),
    statueNames: m.statueNames,
    spotOverrides: m.spotOverrides,
  };
}

export async function exportBackup(): Promise<Blob> {
  const [statuePhotos, panels, statueNames, spotOverrides] = await Promise.all([
    getAllStatuePhotos(),
    getAllPanels(),
    getAllStatueNames(),
    getAllSpotOverrides(),
  ]);
  const zip = await buildBackupZip({ statuePhotos, panels, statueNames, spotOverrides });
  return toBlob(zip, 'application/zip');
}

export async function importBackup(zip: Uint8Array): Promise<{ statuePhotos: number; panels: number }> {
  const d = parseBackupZip(zip);
  for (const v of d.statuePhotos) await putStatuePhoto(v);
  for (const v of d.panels) await putPanel(v);
  for (const v of d.statueNames) await putStatueName(v);
  for (const v of d.spotOverrides) await putSpotOverride(v);
  return { statuePhotos: d.statuePhotos.length, panels: d.panels.length };
}

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.zip`;
}
