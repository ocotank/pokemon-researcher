import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { type BackupData, backupFileName, buildBackupZip, exportBackup, importBackup, parseBackupZip } from './backup';
import {
  getAllPanels,
  getAllSpotPhotos,
  getAllStatueNames,
  getAllStatuePhotos,
  putPanel,
  putSpotPhoto,
  putStatuePhoto,
  resetDatabase,
} from './db';

const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' });

const sample = (): BackupData => ({
  statuePhotos: [{ statueId: 's1', blob: jpeg('statue'), thumb: jpeg('statue-thumb'), takenAt: 10 }],
  spotPhotos: [{ spotId: 'spot1', blob: jpeg('spot'), thumb: jpeg('spot-thumb'), takenAt: 15 }],
  panels: [
    {
      id: 'p1',
      blob: jpeg('panel'),
      thumb: jpeg('panel-thumb'),
      name: 'ピカチュウ',
      memo: 'メモ',
      lat: 35.68,
      lng: 139.77,
      accuracy: 15,
      takenAt: 20,
    },
    { id: 'p2', blob: jpeg('panel2'), name: '', memo: '', takenAt: 30 },
  ],
  statueNames: [{ statueId: 's1', name: 'レックウザ' }],
  spotOverrides: [{ spotId: 'x', lat: 1, lng: 2 }],
});

beforeEach(async () => {
  await resetDatabase();
});

describe('buildBackupZip / parseBackupZip', () => {
  it('往復で内容が一致する', async () => {
    const out = parseBackupZip(await buildBackupZip(sample(), 0));
    expect(out.statueNames).toEqual([{ statueId: 's1', name: 'レックウザ' }]);
    expect(out.spotOverrides).toEqual([{ spotId: 'x', lat: 1, lng: 2 }]);
    expect(out.statuePhotos[0].statueId).toBe('s1');
    expect(await out.statuePhotos[0].blob.text()).toBe('statue');
    expect(await out.statuePhotos[0].thumb?.text()).toBe('statue-thumb');
    expect(out.statuePhotos[0].blob.type).toBe('image/jpeg');
    expect(out.spotPhotos[0].spotId).toBe('spot1');
    expect(await out.spotPhotos[0].blob.text()).toBe('spot');
    expect(await out.spotPhotos[0].thumb?.text()).toBe('spot-thumb');
    const { blob, thumb, ...p1 } = out.panels[0];
    expect(p1).toEqual({
      id: 'p1',
      name: 'ピカチュウ',
      memo: 'メモ',
      lat: 35.68,
      lng: 139.77,
      accuracy: 15,
      takenAt: 20,
    });
    expect(await blob.text()).toBe('panel');
    expect(await thumb?.text()).toBe('panel-thumb');
    expect(out.panels[1].lat).toBeUndefined();
  });

  it('thumb のない旧形式も読み込める', () => {
    const zip = zipSync({
      'data.json': strToU8(
        JSON.stringify({
          version: 1,
          exportedAt: 0,
          statuePhotos: [{ statueId: 's1', takenAt: 10, file: 'photos/statue-s1.jpg' }],
          panels: [{ id: 'p1', name: '', memo: '', takenAt: 20, file: 'photos/panel-p1.jpg' }],
          statueNames: [],
          spotOverrides: [],
        }),
      ),
      'photos/statue-s1.jpg': strToU8('statue'),
      'photos/panel-p1.jpg': strToU8('panel'),
    });

    const out = parseBackupZip(zip);
    expect(out.statuePhotos[0].thumb).toBeUndefined();
    expect(out.panels[0].thumb).toBeUndefined();
    expect(out.spotPhotos).toEqual([]);
  });

  it('data.json が無ければエラー', () => {
    expect(() => parseBackupZip(zipSync({ 'x.txt': strToU8('x') }))).toThrow('data.json が見つかりません');
  });

  it('未対応バージョンはエラー', () => {
    const zip = zipSync({ 'data.json': strToU8(JSON.stringify({ version: 99 })) });
    expect(() => parseBackupZip(zip)).toThrow('未対応のバックアップ形式です');
  });
});

describe('exportBackup / importBackup', () => {
  it('書き出したものを空の DB に読み込むと元に戻る', async () => {
    await putStatuePhoto({ statueId: 's1', blob: jpeg('statue'), takenAt: 10 });
    await putSpotPhoto({ spotId: 'spot1', blob: jpeg('spot'), takenAt: 15 });
    await putPanel({ id: 'p1', blob: jpeg('panel'), name: 'a', memo: '', takenAt: 20 });
    const zip = new Uint8Array(await (await exportBackup()).arrayBuffer());

    await resetDatabase();
    const counts = await importBackup(zip);

    expect(counts).toEqual({ statuePhotos: 1, panels: 1 });
    expect((await getAllStatuePhotos())[0].statueId).toBe('s1');
    expect(await (await getAllSpotPhotos())[0].blob.text()).toBe('spot');
    expect(await (await getAllPanels())[0].blob.text()).toBe('panel');
  });

  it('既存データとマージする', async () => {
    await putPanel({ id: 'existing', blob: jpeg('e'), name: '', memo: '', takenAt: 1 });
    await importBackup(await buildBackupZip(sample()));
    expect((await getAllPanels()).map((p) => p.id).sort()).toEqual(['existing', 'p1', 'p2']);
    expect(await getAllStatueNames()).toEqual([{ statueId: 's1', name: 'レックウザ' }]);
  });
});

describe('backupFileName', () => {
  it('日時からファイル名を作る', () => {
    expect(backupFileName(new Date(2026, 8, 24, 9, 5))).toBe('backup-20260924-0905.zip');
  });
});
