import { describe, expect, it } from 'vitest';
import { ALL_STATUES, SPOTS, applyOverrides } from './spots';

describe('SPOTS', () => {
  it('公式 MAP どおり 9 スポット・19 体', () => {
    expect(SPOTS).toHaveLength(9);
    expect(ALL_STATUES).toHaveLength(19);
  });

  it('ID が重複しない', () => {
    const spotIds = SPOTS.map((s) => s.id);
    const statueIds = ALL_STATUES.map((s) => s.id);
    expect(new Set(spotIds).size).toBe(spotIds.length);
    expect(new Set(statueIds).size).toBe(statueIds.length);
  });

  it('座標が日本橋・八重洲の範囲内', () => {
    for (const s of SPOTS) {
      expect(s.lat).toBeGreaterThan(35.67);
      expect(s.lat).toBeLessThan(35.7);
      expect(s.lng).toBeGreaterThan(139.76);
      expect(s.lng).toBeLessThan(139.78);
    }
  });
});

describe('applyOverrides', () => {
  it('上書きが無ければ元の値のまま', () => {
    const out = applyOverrides(SPOTS, new Map(), new Map());
    expect(out).toEqual(SPOTS);
  });

  it('座標の上書きを反映する', () => {
    const target = SPOTS[0];
    const out = applyOverrides(SPOTS, new Map([[target.id, { lat: 35.1, lng: 139.1 }]]), new Map());
    expect(out[0].lat).toBe(35.1);
    expect(out[0].lng).toBe(139.1);
    expect(out[1]).toEqual(SPOTS[1]);
  });

  it('名前の上書きで仮バッジが外れる', () => {
    const statue = SPOTS[0].statues[0];
    const out = applyOverrides(SPOTS, new Map(), new Map([[statue.id, 'テスト名']]));
    expect(out[0].statues[0]).toEqual({ id: statue.id, name: 'テスト名', tentative: false });
  });
});
