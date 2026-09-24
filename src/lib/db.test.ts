import { beforeEach, describe, expect, it } from 'vitest';
import {
  deletePanel,
  deleteSpotOverride,
  deleteStatueName,
  deleteStatuePhoto,
  getAllPanels,
  getAllSpotOverrides,
  getAllStatueNames,
  getAllStatuePhotos,
  putPanel,
  putSpotOverride,
  putStatueName,
  putStatuePhoto,
  resetDatabase,
} from './db';

const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' });

beforeEach(async () => {
  await resetDatabase();
});

describe('statuePhotos', () => {
  it('保存・同じ立像は上書き・削除', async () => {
    await putStatuePhoto({ statueId: 's1', blob: jpeg('old'), takenAt: 1 });
    await putStatuePhoto({ statueId: 's1', blob: jpeg('new'), takenAt: 2 });
    const all = await getAllStatuePhotos();
    expect(all).toHaveLength(1);
    expect(all[0].takenAt).toBe(2);
    expect(await all[0].blob.text()).toBe('new');

    await deleteStatuePhoto('s1');
    expect(await getAllStatuePhotos()).toEqual([]);
  });
});

describe('panels', () => {
  it('新しい順で返す・位置なしも保存できる・削除', async () => {
    await putPanel({ id: 'p1', blob: jpeg('a'), name: '', memo: '', takenAt: 100 });
    await putPanel({ id: 'p2', blob: jpeg('b'), name: 'ピカチュウ', memo: '柱', lat: 35.68, lng: 139.77, accuracy: 20, takenAt: 200 });
    const all = await getAllPanels();
    expect(all.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(all[0].lat).toBe(35.68);
    expect(all[1].lat).toBeUndefined();

    await deletePanel('p2');
    expect((await getAllPanels()).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('statueNames / spotOverrides', () => {
  it('保存・削除', async () => {
    await putStatueName({ statueId: 's1', name: 'レックウザ' });
    await putSpotOverride({ spotId: 'x', lat: 1, lng: 2 });
    expect(await getAllStatueNames()).toEqual([{ statueId: 's1', name: 'レックウザ' }]);
    expect(await getAllSpotOverrides()).toEqual([{ spotId: 'x', lat: 1, lng: 2 }]);

    await deleteStatueName('s1');
    await deleteSpotOverride('x');
    expect(await getAllStatueNames()).toEqual([]);
    expect(await getAllSpotOverrides()).toEqual([]);
  });
});
