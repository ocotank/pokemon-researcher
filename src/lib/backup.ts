import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  getAllPanels,
  getAllSpotOverrides,
  getAllStatueNames,
  getAllStatuePhotos,
  type Panel,
  putPanel,
  putSpotOverride,
  putStatueName,
  putStatuePhoto,
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
  statuePhotos: (Omit<StatuePhoto, 'blob' | 'thumb'> & { file: string; thumbFile?: string })[];
  panels: (Omit<Panel, 'blob' | 'thumb'> & { file: string; thumbFile?: string })[];
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
  for (const { blob, thumb, ...rest } of d.statuePhotos) {
    const file = `photos/statue-${rest.statueId}.jpg`;
    files[file] = await toBytes(blob);
    const thumbFile = thumb ? `photos/statue-${rest.statueId}-thumb.jpg` : undefined;
    if (thumb && thumbFile) files[thumbFile] = await toBytes(thumb);
    manifest.statuePhotos.push({ ...rest, file, ...(thumbFile ? { thumbFile } : {}) });
  }
  for (const { blob, thumb, ...rest } of d.panels) {
    const file = `photos/panel-${rest.id}.jpg`;
    files[file] = await toBytes(blob);
    const thumbFile = thumb ? `photos/panel-${rest.id}-thumb.jpg` : undefined;
    if (thumb && thumbFile) files[thumbFile] = await toBytes(thumb);
    manifest.panels.push({ ...rest, file, ...(thumbFile ? { thumbFile } : {}) });
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
    statuePhotos: m.statuePhotos.map(({ file, thumbFile, ...rest }) => ({
      ...rest,
      blob: photo(file),
      ...(thumbFile ? { thumb: photo(thumbFile) } : {}),
    })),
    panels: m.panels.map(({ file, thumbFile, ...rest }) => ({
      ...rest,
      blob: photo(file),
      ...(thumbFile ? { thumb: photo(thumbFile) } : {}),
    })),
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
