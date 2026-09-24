# レジェンドリサーチ・コレクター Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPhone Safari 向けの PWA。立像 19 体を現在地から近い順に表示して写真を集め、街中のパネルを見つけ次第写真＋位置で記録する。

**Architecture:** Vite + React + TypeScript のクライアントのみのアプリ。データは端末内 IndexedDB に保存し、バックアップは ZIP で書き出し／読み込み。純粋ロジック（距離・データ解決・バックアップ・DB）を `src/lib` と `src/data` に分けて Vitest でテストし、UI は `src/components` に置く。

**Tech Stack:** Vite 8, React 19, TypeScript 5.9, vite-plugin-pwa 1.x, idb 8, fflate 0.8, Vitest 5, fake-indexeddb 6, @vite-pwa/assets-generator

**Spec:** `docs/superpowers/specs/2026-09-24-legend-research-collector-design.md`

## Global Constraints

- 対象ブラウザ: iPhone Safari（ホーム画面追加の standalone 表示を含む）。Node 24 で開発。
- 写真・記録はすべて端末内 IndexedDB（DB 名 `legend-research`, version 1）。外部送信しない。
- AI/外部 API は使わない。Google マップは URL リンクで開くだけ（API キー不要）。
- 写真は長辺 1600px の JPEG（品質 0.85）に縮小して保存。
- UI 文言はすべて日本語。
- テキスト入力は `font-size: 16px` 以上（iOS の自動ズーム防止）。
- GitHub Pages 公開時は環境変数 `BASE_PATH`（例 `/pokemon-researcher/`）を Vite の `base` に渡す。未指定時は `/`。
- TypeScript は `typescript@~5.9` に固定（7.x はネイティブ版で互換性リスクがあるため）。
- `crypto.randomUUID` と位置情報はセキュアコンテキスト（https / localhost）でのみ動く。LAN の `http://192.168.x.x` で iPhone から開くと動かない。

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore, README.md
.github/workflows/deploy.yml
public/icon.svg (+ 生成アイコン)
src/
  main.tsx, App.tsx, index.css
  test/setup.ts                 fake-indexeddb を読み込む
  data/spots.ts                 固定データ + applyOverrides
  data/spots.test.ts
  lib/geo.ts / geo.test.ts      距離・並び替え・表示・URL
  lib/db.ts / db.test.ts        IndexedDB CRUD
  lib/backup.ts / backup.test.ts ZIP 書き出し・読み込み
  lib/image.ts / image.test.ts  縮小（fitWithin はテスト）
  lib/share.ts                  共有シート / ダウンロード
  hooks/useGeolocation.ts       位置の監視・単発取得
  hooks/useCollection.ts        DB 全体を state に読み込む
  components/
    TabBar.tsx, BlobImage.tsx, PhotoButton.tsx, Sheet.tsx, GeoBanner.tsx
    StatueTab.tsx, SpotCard.tsx
    PanelTab.tsx, PanelForm.tsx, PanelDetail.tsx
    SettingsTab.tsx
```

---

### Task 1: プロジェクト雛形と立像データ

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`
- Create: `src/data/spots.ts`
- Test: `src/data/spots.test.ts`

**Interfaces:**
- Produces:
  - `type Statue = { id: string; name: string; tentative: boolean }`
  - `type Spot = { id: string; facility: string; floor: string; place: string; lat: number; lng: number; statues: Statue[] }`
  - `const SPOTS: readonly Spot[]`, `const ALL_STATUES: readonly Statue[]`
  - `applyOverrides(spots: readonly Spot[], overrides: ReadonlyMap<string, { lat: number; lng: number }>, names: ReadonlyMap<string, string>): Spot[]`

- [ ] **Step 1: 設定ファイルを作成**

`package.json`:
```json
{
  "name": "pokemon-researcher",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`（PWA は Task 10 で追加）:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
```

`.gitignore`:
```
node_modules
dist
dev-dist
*.local
.DS_Store
```

`index.html`:
```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b5566" />
    <title>レジェンドリサーチ・コレクター</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`（Task 6 で置き換え）:
```tsx
export default function App() {
  return <p>レジェンドリサーチ・コレクター</p>;
}
```

`src/index.css`: 空ファイル（Task 6 で中身を書く）。

`src/test/setup.ts`:
```ts
import 'fake-indexeddb/auto';
```

- [ ] **Step 2: 依存をインストール**

Run:
```bash
npm install react@^19 react-dom@^19 idb@^8 fflate@^0.8
npm install -D vite@^8 @vitejs/plugin-react@^6 typescript@~5.9 @types/react@^19 @types/react-dom@^19 @types/node@^24 vitest@^5 fake-indexeddb@^6 vite-plugin-pwa@^1 @vite-pwa/assets-generator@^1 workbox-window@^7
```
Expected: エラーなく完了し `package-lock.json` ができる。

- [ ] **Step 3: 失敗するテストを書く** — `src/data/spots.test.ts`

```ts
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
```

- [ ] **Step 4: 失敗を確認**

Run: `npx vitest run src/data/spots.test.ts`
Expected: FAIL（`./spots` が見つからない）

- [ ] **Step 5: 実装** — `src/data/spots.ts`

```ts
// 公式サイト（https://mitsui-shopping-park.com/urban/legend-research/）の会場 MAP より。
// 座標は建物位置からの概算。tentative: true はシルエットからの推測で、アプリ内で名前を編集できる。

export type Statue = { id: string; name: string; tentative: boolean };

export type Spot = {
  id: string;
  facility: string;
  floor: string;
  place: string;
  lat: number;
  lng: number;
  statues: Statue[];
};

const UNKNOWN = '未確認のポケモン';

export const SPOTS: readonly Spot[] = [
  {
    id: 'terrace-b1f',
    facility: 'COREDO室町テラス',
    floor: 'B1F',
    place: '郵便局前',
    lat: 35.6884,
    lng: 139.7737,
    statues: [
      { id: 'terrace-b1f-1', name: 'ホウオウ', tentative: true },
      { id: 'terrace-b1f-2', name: 'ルギア', tentative: true },
    ],
  },
  {
    id: 'terrace-1f',
    facility: 'COREDO室町テラス',
    floor: '1F',
    place: 'エスカレーターピロティ',
    lat: 35.6884,
    lng: 139.7737,
    statues: [
      { id: 'terrace-1f-1', name: UNKNOWN, tentative: true },
      { id: 'terrace-1f-2', name: UNKNOWN, tentative: true },
    ],
  },
  {
    id: 'muromachi12-b1f',
    facility: 'COREDO室町1・2',
    floor: 'B1F',
    place: 'COREDO室町1・2 地下歩道',
    lat: 35.6872,
    lng: 139.7744,
    statues: [
      { id: 'muromachi12-b1f-1', name: 'ディアルガ', tentative: true },
      { id: 'muromachi12-b1f-2', name: 'パルキア', tentative: true },
    ],
  },
  {
    id: 'mitsui-tower-1f',
    facility: '日本橋三井タワー',
    floor: '1F',
    place: 'アトリウム',
    lat: 35.6866,
    lng: 139.7731,
    statues: [
      { id: 'mitsui-tower-1f-1', name: 'フシギバナ', tentative: false },
      { id: 'mitsui-tower-1f-2', name: 'リザードン', tentative: false },
      { id: 'mitsui-tower-1f-3', name: 'カメックス', tentative: false },
    ],
  },
  {
    id: 'annaisho-b1f',
    facility: 'COREDO室町3付近',
    floor: 'B1F',
    place: '日本橋案内所／わくわく広場前',
    lat: 35.6866,
    lng: 139.7744,
    statues: [
      { id: 'annaisho-b1f-1', name: UNKNOWN, tentative: true },
      { id: 'annaisho-b1f-2', name: UNKNOWN, tentative: true },
    ],
  },
  {
    id: 'midtown-b1f',
    facility: '東京ミッドタウン八重洲',
    floor: 'B1F',
    place: 'YAESU BASE',
    lat: 35.6793,
    lng: 139.769,
    statues: [
      { id: 'midtown-b1f-1', name: UNKNOWN, tentative: true },
      { id: 'midtown-b1f-2', name: UNKNOWN, tentative: true },
    ],
  },
  {
    id: 'midtown-1f',
    facility: '東京ミッドタウン八重洲',
    floor: '1F',
    place: 'アトリウム',
    lat: 35.6793,
    lng: 139.769,
    statues: [
      { id: 'midtown-1f-1', name: 'ゼルネアス', tentative: false },
      { id: 'midtown-1f-2', name: 'イベルタル', tentative: false },
    ],
  },
  {
    id: 'midtown-2f',
    facility: '東京ミッドタウン八重洲',
    floor: '2F',
    place: 'Hacoa DIRECT STORE横スペース',
    lat: 35.6793,
    lng: 139.769,
    statues: [
      { id: 'midtown-2f-1', name: UNKNOWN, tentative: true },
      { id: 'midtown-2f-2', name: UNKNOWN, tentative: true },
    ],
  },
  {
    id: 'midtown-3f',
    facility: '東京ミッドタウン八重洲',
    floor: '3F',
    place: 'エスカレーター下',
    lat: 35.6793,
    lng: 139.769,
    statues: [
      { id: 'midtown-3f-1', name: 'ソルガレオ', tentative: true },
      { id: 'midtown-3f-2', name: 'ルナアーラ', tentative: true },
    ],
  },
];

export const ALL_STATUES: readonly Statue[] = SPOTS.flatMap((s) => s.statues);

export function applyOverrides(
  spots: readonly Spot[],
  overrides: ReadonlyMap<string, { lat: number; lng: number }>,
  names: ReadonlyMap<string, string>,
): Spot[] {
  return spots.map((spot) => {
    const o = overrides.get(spot.id);
    return {
      ...spot,
      ...(o ? { lat: o.lat, lng: o.lng } : {}),
      statues: spot.statues.map((st) => {
        const name = names.get(st.id);
        return name ? { ...st, name, tentative: false } : st;
      }),
    };
  });
}
```

- [ ] **Step 6: テストとビルドが通ることを確認**

Run: `npx vitest run src/data/spots.test.ts && npm run build`
Expected: 6 tests PASS、ビルド成功（`dist/` ができる）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: プロジェクト雛形と立像スポットデータを追加"
```

---

### Task 2: 距離計算と地図 URL（`lib/geo.ts`）

**Files:**
- Create: `src/lib/geo.ts`
- Test: `src/lib/geo.test.ts`

**Interfaces:**
- Produces:
  - `type LatLng = { lat: number; lng: number }`
  - `distanceMeters(a: LatLng, b: LatLng): number`
  - `formatDistance(m: number): string`
  - `type WithDistance<T> = { item: T; distance: number | null }`
  - `sortByDistance<T extends LatLng>(items: readonly T[], here: LatLng | null): WithDistance<T>[]`
  - `directionsUrl(to: LatLng): string`, `placeUrl(p: LatLng): string`

- [ ] **Step 1: 失敗するテストを書く** — `src/lib/geo.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { directionsUrl, distanceMeters, formatDistance, placeUrl, sortByDistance } from './geo';

describe('distanceMeters', () => {
  it('同じ地点は 0', () => {
    expect(distanceMeters({ lat: 35.68, lng: 139.77 }, { lat: 35.68, lng: 139.77 })).toBe(0);
  });

  it('緯度 1 度はおよそ 111,195m', () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(Math.abs(d - 111195)).toBeLessThan(1);
  });

  it('三井タワー → ミッドタウン八重洲はおよそ 1km', () => {
    const d = distanceMeters({ lat: 35.6866, lng: 139.7731 }, { lat: 35.6793, lng: 139.769 });
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(1000);
  });
});

describe('formatDistance', () => {
  it.each([
    [5, 'すぐ近く'],
    [123, '約120m'],
    [994, '約990m'],
    [996, '約1.0km'],
    [1234, '約1.2km'],
  ])('%d m → %s', (m, expected) => {
    expect(formatDistance(m)).toBe(expected);
  });
});

describe('sortByDistance', () => {
  const a = { id: 'a', lat: 35.6866, lng: 139.7731 };
  const b = { id: 'b', lat: 35.6793, lng: 139.769 };

  it('現在地が無ければ元の順・距離 null', () => {
    expect(sortByDistance([a, b], null)).toEqual([
      { item: a, distance: null },
      { item: b, distance: null },
    ]);
  });

  it('現在地から近い順に並べる', () => {
    const out = sortByDistance([a, b], { lat: 35.6795, lng: 139.7691 });
    expect(out.map((x) => x.item.id)).toEqual(['b', 'a']);
    expect(out[0].distance).toBeLessThan(out[1].distance!);
  });
});

describe('URL', () => {
  it('徒歩の道順 URL', () => {
    expect(directionsUrl({ lat: 35.1, lng: 139.2 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=35.1,139.2&travelmode=walking',
    );
  });

  it('場所の URL', () => {
    expect(placeUrl({ lat: 35.1, lng: 139.2 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=35.1,139.2',
    );
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: FAIL（`./geo` が見つからない）

- [ ] **Step 3: 実装** — `src/lib/geo.ts`

```ts
export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

// ハーバーサイン式
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 10) return 'すぐ近く';
  const rounded = Math.round(m / 10) * 10;
  if (rounded < 1000) return `約${rounded}m`;
  return `約${(m / 1000).toFixed(1)}km`;
}

export type WithDistance<T> = { item: T; distance: number | null };

export function sortByDistance<T extends LatLng>(
  items: readonly T[],
  here: LatLng | null,
): WithDistance<T>[] {
  if (!here) return items.map((item) => ({ item, distance: null }));
  return items
    .map((item) => ({ item, distance: distanceMeters(here, item) }))
    .sort((x, y) => x.distance - y.distance);
}

export function directionsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=walking`;
}

export function placeUrl(p: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}
```

- [ ] **Step 4: 通ることを確認**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts src/lib/geo.test.ts
git commit -m "feat: 距離計算と Google マップ URL を追加"
```

---

### Task 3: IndexedDB アクセス（`lib/db.ts`）

**Files:**
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Produces:
  - `type StatuePhoto = { statueId: string; blob: Blob; takenAt: number }`
  - `type Panel = { id: string; blob: Blob; name: string; memo: string; lat?: number; lng?: number; accuracy?: number; takenAt: number }`
  - `type StatueName = { statueId: string; name: string }`
  - `type SpotOverride = { spotId: string; lat: number; lng: number }`
  - `putStatuePhoto(v)`, `getAllStatuePhotos(): Promise<StatuePhoto[]>`, `deleteStatuePhoto(statueId)`
  - `putPanel(v)`, `getAllPanels(): Promise<Panel[]>`（takenAt 降順）, `deletePanel(id)`
  - `putStatueName(v)`, `getAllStatueNames(): Promise<StatueName[]>`, `deleteStatueName(statueId)`
  - `putSpotOverride(v)`, `getAllSpotOverrides(): Promise<SpotOverride[]>`, `deleteSpotOverride(spotId)`
  - `resetDatabase(): Promise<void>`（テスト用。接続を閉じて DB を削除）
  - put/delete はすべて `Promise<void>`

- [ ] **Step 1: 失敗するテストを書く** — `src/lib/db.test.ts`

```ts
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/db.test.ts`
Expected: FAIL（`./db` が見つからない）

- [ ] **Step 3: 実装** — `src/lib/db.ts`

```ts
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
```

- [ ] **Step 4: 通ることを確認**

Run: `npx vitest run src/lib/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "feat: IndexedDB の保存・取得・削除を追加"
```

---

### Task 4: バックアップ ZIP（`lib/backup.ts`）

**Files:**
- Create: `src/lib/backup.ts`
- Test: `src/lib/backup.test.ts`

**Interfaces:**
- Consumes: Task 3 の型と `getAll*` / `put*`
- Produces:
  - `type BackupData = { statuePhotos: StatuePhoto[]; panels: Panel[]; statueNames: StatueName[]; spotOverrides: SpotOverride[] }`
  - `buildBackupZip(d: BackupData, now?: number): Promise<Uint8Array>`
  - `parseBackupZip(zip: Uint8Array): BackupData`（不正なら日本語メッセージの Error を投げる）
  - `exportBackup(): Promise<Blob>`（DB 全体 → ZIP Blob）
  - `importBackup(zip: Uint8Array): Promise<{ statuePhotos: number; panels: number }>`（マージ、同 ID 上書き）
  - `backupFileName(d?: Date): string` → `backup-YYYYMMDD-HHmm.zip`

- [ ] **Step 1: 失敗するテストを書く** — `src/lib/backup.test.ts`

```ts
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { backupFileName, buildBackupZip, exportBackup, importBackup, parseBackupZip, type BackupData } from './backup';
import { getAllPanels, getAllStatueNames, getAllStatuePhotos, putPanel, putStatuePhoto, resetDatabase } from './db';

const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' });

const sample = (): BackupData => ({
  statuePhotos: [{ statueId: 's1', blob: jpeg('statue'), takenAt: 10 }],
  panels: [
    { id: 'p1', blob: jpeg('panel'), name: 'ピカチュウ', memo: 'メモ', lat: 35.68, lng: 139.77, accuracy: 15, takenAt: 20 },
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
    expect(out.statuePhotos[0].blob.type).toBe('image/jpeg');
    const { blob, ...p1 } = out.panels[0];
    expect(p1).toEqual({ id: 'p1', name: 'ピカチュウ', memo: 'メモ', lat: 35.68, lng: 139.77, accuracy: 15, takenAt: 20 });
    expect(await blob.text()).toBe('panel');
    expect(out.panels[1].lat).toBeUndefined();
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
    await putPanel({ id: 'p1', blob: jpeg('panel'), name: 'a', memo: '', takenAt: 20 });
    const zip = new Uint8Array(await (await exportBackup()).arrayBuffer());

    await resetDatabase();
    const counts = await importBackup(zip);

    expect(counts).toEqual({ statuePhotos: 1, panels: 1 });
    expect((await getAllStatuePhotos())[0].statueId).toBe('s1');
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/backup.test.ts`
Expected: FAIL（`./backup` が見つからない）

- [ ] **Step 3: 実装** — `src/lib/backup.ts`

```ts
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
```

- [ ] **Step 4: 通ることを確認**

Run: `npx vitest run src/lib/backup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/backup.ts src/lib/backup.test.ts
git commit -m "feat: バックアップ ZIP の書き出し・読み込みを追加"
```

---

### Task 5: 画像縮小と共有（`lib/image.ts`, `lib/share.ts`）

**Files:**
- Create: `src/lib/image.ts`, `src/lib/share.ts`
- Test: `src/lib/image.test.ts`

**Interfaces:**
- Produces:
  - `fitWithin(width: number, height: number, max: number): { width: number; height: number }`
  - `toResizedJpeg(file: Blob, max?: number, quality?: number): Promise<Blob>`（ブラウザ専用）
  - `shareOrDownload(blob: Blob, filename: string): Promise<void>`（共有シート → 不可ならダウンロード。ユーザー操作の直後に呼ぶこと）

- [ ] **Step 1: 失敗するテストを書く** — `src/lib/image.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fitWithin } from './image';

describe('fitWithin', () => {
  it('横長を長辺 1600 に縮める', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });
  it('縦長を長辺 1600 に縮める', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it('小さい画像は拡大しない', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/image.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装** — `src/lib/image.ts`

```ts
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// <img> 経由で読み込むと Safari が EXIF の向きを反映してくれる
export async function toResizedJpeg(file: Blob, max = 1600, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, max);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画像を処理できませんでした');
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('画像を保存できませんでした'))),
        'image/jpeg',
        quality,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

`src/lib/share.ts`:
```ts
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// iPhone では共有シートから「画像を保存」「"ファイル"に保存」を選べる
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // NotAllowedError などはダウンロードで代替
    }
  }
  download(blob, filename);
}
```

- [ ] **Step 4: 通ることを確認**

Run: `npx vitest run src/lib/image.test.ts && npx tsc --noEmit`
Expected: PASS、型エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/lib/image.ts src/lib/image.test.ts src/lib/share.ts
git commit -m "feat: 写真の縮小と共有シートでの保存を追加"
```

---

### Task 6: アプリの骨組み（フック・共通部品・タブ・CSS）

**Files:**
- Create: `src/hooks/useGeolocation.ts`, `src/hooks/useCollection.ts`
- Create: `src/components/TabBar.tsx`, `src/components/BlobImage.tsx`, `src/components/PhotoButton.tsx`, `src/components/Sheet.tsx`, `src/components/GeoBanner.tsx`
- Modify: `src/App.tsx`（全体を置き換え）, `src/index.css`（全体を書く）

**Interfaces:**
- Consumes: Task 3 の `getAll*`、Task 5 の `toResizedJpeg`
- Produces:
  - `type Position = { lat: number; lng: number; accuracy: number }`
  - `type GeoState = { status: 'unsupported' | 'locating' | 'ok' | 'denied' | 'error'; position: Position | null; message?: string }`
  - `useGeolocation(enabled: boolean): GeoState`、`getPositionOnce(timeoutMs?: number): Promise<Position | null>`
  - `type Collection = { statuePhotos: Map<string, StatuePhoto>; panels: Panel[]; statueNames: Map<string, string>; spotOverrides: Map<string, SpotOverride>; loaded: boolean; reload: () => Promise<void> }`
  - `useCollection(): Collection`
  - `type Tab = 'statues' | 'panels' | 'settings'`、`<TabBar current onChange />`
  - `<BlobImage blob alt className? onClick? />`、`<PhotoButton label onPhoto className? />`（onPhoto には縮小済み JPEG が渡る）
  - `<Sheet title onClose>{children}</Sheet>`、`<GeoBanner geo />`

- [ ] **Step 1: フックを作成**

`src/hooks/useGeolocation.ts`:
```ts
import { useEffect, useState } from 'react';

export type Position = { lat: number; lng: number; accuracy: number };
export type GeoState = {
  status: 'unsupported' | 'locating' | 'ok' | 'denied' | 'error';
  position: Position | null;
  message?: string;
};

const supported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;
const toPosition = (p: GeolocationPosition): Position => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
});
const PERMISSION_DENIED = 1;

export function useGeolocation(enabled: boolean): GeoState {
  const [state, setState] = useState<GeoState>(() =>
    supported()
      ? { status: 'locating', position: null }
      : { status: 'unsupported', position: null, message: 'この端末では位置情報が使えません' },
  );

  useEffect(() => {
    if (!enabled || !supported()) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setState({ status: 'ok', position: toPosition(p) }),
      (e) =>
        setState((s) =>
          e.code === PERMISSION_DENIED
            ? {
                status: 'denied',
                position: null,
                message: '位置情報が許可されていません。設定アプリ →「プライバシーとセキュリティ」→「位置情報サービス」→「Safari」から許可してください',
              }
            : {
                status: 'error',
                position: s.position,
                message: '現在地を取得できませんでした（地下や屋内では取れないことがあります）',
              },
        ),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}

export function getPositionOnce(timeoutMs = 10_000): Promise<Position | null> {
  if (!supported()) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toPosition(p)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    ),
  );
}
```

`src/hooks/useCollection.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import {
  getAllPanels,
  getAllSpotOverrides,
  getAllStatueNames,
  getAllStatuePhotos,
  type Panel,
  type SpotOverride,
  type StatuePhoto,
} from '../lib/db';

export type Collection = {
  statuePhotos: Map<string, StatuePhoto>;
  panels: Panel[];
  statueNames: Map<string, string>;
  spotOverrides: Map<string, SpotOverride>;
  loaded: boolean;
  reload: () => Promise<void>;
};

type Data = Omit<Collection, 'reload'>;

export function useCollection(): Collection {
  const [data, setData] = useState<Data>({
    statuePhotos: new Map(),
    panels: [],
    statueNames: new Map(),
    spotOverrides: new Map(),
    loaded: false,
  });

  const reload = useCallback(async () => {
    const [photos, panels, names, overrides] = await Promise.all([
      getAllStatuePhotos(),
      getAllPanels(),
      getAllStatueNames(),
      getAllSpotOverrides(),
    ]);
    setData({
      statuePhotos: new Map(photos.map((p) => [p.statueId, p])),
      panels,
      statueNames: new Map(names.map((n) => [n.statueId, n.name])),
      spotOverrides: new Map(overrides.map((o) => [o.spotId, o])),
      loaded: true,
    });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...data, reload };
}
```

- [ ] **Step 2: 共通コンポーネントを作成**

`src/components/TabBar.tsx`:
```tsx
export type Tab = 'statues' | 'panels' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'statues', label: '立像', icon: '🗿' },
  { id: 'panels', label: 'パネル', icon: '🖼️' },
  { id: 'settings', label: '設定', icon: '⚙️' },
];

export function TabBar({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.id === current ? 'active' : ''}
          aria-current={t.id === current ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
```

`src/components/BlobImage.tsx`:
```tsx
import { useEffect, useState } from 'react';

type Props = { blob: Blob; alt: string; className?: string; onClick?: () => void };

export function BlobImage({ blob, alt, className, onClick }: Props) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} onClick={onClick} />;
}
```

`src/components/PhotoButton.tsx`:
```tsx
import { useRef, useState, type ChangeEvent } from 'react';
import { toResizedJpeg } from '../lib/image';

type Props = { label: string; onPhoto: (jpeg: Blob) => void | Promise<void>; className?: string };

export function PhotoButton({ label, onPhoto, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await onPhoto(await toResizedJpeg(file));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? '処理中…' : label}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleChange} />
    </>
  );
}
```

`src/components/Sheet.tsx`:
```tsx
import type { ReactNode } from 'react';

type Props = { title: string; onClose: () => void; children: ReactNode };

export function Sheet({ title, onClose, children }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="link" onClick={onClose}>
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

`src/components/GeoBanner.tsx`:
```tsx
import type { GeoState } from '../hooks/useGeolocation';

export function GeoBanner({ geo }: { geo: GeoState }) {
  if (geo.status === 'ok' && geo.position) {
    return <p className="banner ok">📍 現在地を取得済み（誤差 ±{Math.round(geo.position.accuracy)}m）</p>;
  }
  if (geo.status === 'locating') {
    return <p className="banner">📍 現在地を取得中…</p>;
  }
  return (
    <p className="banner">
      ⚠️ {geo.message}
      {!geo.position && '。距離なしで表示しています'}
    </p>
  );
}
```

- [ ] **Step 3: App と CSS**

`src/App.tsx`（Task 7〜9 のタブは仮表示にしておき、各タスクで差し替える）:
```tsx
import { useEffect, useState } from 'react';
import { TabBar, type Tab } from './components/TabBar';
import { GeoBanner } from './components/GeoBanner';
import { useCollection } from './hooks/useCollection';
import { useGeolocation } from './hooks/useGeolocation';

export default function App() {
  const [tab, setTab] = useState<Tab>('statues');
  const collection = useCollection();
  const geo = useGeolocation(tab === 'statues');

  useEffect(() => {
    void navigator.storage?.persist?.();
  }, []);

  return (
    <div className="app">
      <main>
        {tab === 'statues' && (
          <section className="page">
            <h1>立像</h1>
            <GeoBanner geo={geo} />
          </section>
        )}
        {tab === 'panels' && (
          <section className="page">
            <h1>パネル</h1>
            <p>{collection.panels.length}体</p>
          </section>
        )}
        {tab === 'settings' && (
          <section className="page">
            <h1>設定</h1>
          </section>
        )}
      </main>
      <TabBar current={tab} onChange={setTab} />
    </div>
  );
}
```

`src/index.css`:
```css
:root {
  --teal: #0b5566;
  --cream: #fdf6e9;
  --paper: #fffdf8;
  --ink: #2b2118;
  --muted: #7a6a58;
  --yellow: #f5d90a;
  --line: #e6dccb;
  --danger: #c0392b;
  --radius: 14px;
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  color: var(--ink);
  background: var(--cream);
  -webkit-text-size-adjust: 100%;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--cream); }
button, input, textarea { font: inherit; }

.app { min-height: 100dvh; padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
.page { max-width: 640px; margin: 0 auto; padding: calc(12px + env(safe-area-inset-top)) 16px 24px; }
.page h1 { margin: 4px 0; font-size: 1.5rem; color: var(--teal); }
.progress { margin: 0 0 8px; }
.progress strong { font-size: 1.4rem; color: var(--teal); }
.banner { font-size: 0.85rem; padding: 8px 12px; border-radius: 10px; background: #fff3c4; margin: 0 0 12px; }
.banner.ok { background: #e3f1ef; }
.muted, .empty-text { color: var(--muted); font-size: 0.85rem; }

.card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
.card h2 { margin: 0 0 8px; font-size: 1.1rem; }
.card p { margin: 0 0 10px; }

.spot-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.facility { margin: 0; font-size: 0.8rem; color: var(--muted); }
.spot-head h2 { margin: 2px 0 0; font-size: 1.05rem; }
.floor { display: inline-block; background: var(--teal); color: #fff; border-radius: 6px; padding: 0 6px; margin-right: 6px; font-size: 0.85rem; }
.distance { margin: 0; font-weight: 700; color: var(--teal); white-space: nowrap; }

.statues { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 10px; }
.statues li { display: grid; grid-template-columns: 64px 1fr auto; gap: 10px; align-items: center; }
.thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #eee; display: block; }
.thumb.empty { display: grid; place-items: center; color: var(--muted); font-size: 1.4rem; border: 2px dashed var(--line); background: transparent; }
.statues li.done .thumb { outline: 3px solid var(--yellow); }
.name { justify-content: flex-start; text-align: left; background: none; border: none; padding: 0; min-height: 0; color: var(--ink); font-weight: 600; }
.badge { margin-left: 6px; font-size: 0.7rem; background: var(--line); color: var(--muted); border-radius: 4px; padding: 1px 4px; }
.row-actions { display: flex; flex-direction: column; gap: 6px; }

button, .button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--line); background: #fff; color: var(--ink); text-decoration: none; font-weight: 600; cursor: pointer; }
button:disabled { opacity: 0.5; }
.primary { background: var(--teal); border-color: var(--teal); color: #fff; }
.danger { color: var(--danger); border-color: currentColor; }
.big { width: 100%; min-height: 52px; font-size: 1.1rem; margin: 8px 0 16px; }
.link { background: none; border: none; color: var(--teal); text-decoration: underline; padding: 0 4px; min-height: 32px; font-weight: 500; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.grid button { display: block; width: 100%; padding: 0; border-radius: 10px; overflow: hidden; min-height: 0; background: var(--paper); }
.grid img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
.grid span { display: block; font-size: 0.75rem; padding: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.tabbar { position: fixed; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(3, 1fr); background: var(--paper); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); z-index: 10; }
.tabbar button { border: none; border-radius: 0; background: none; flex-direction: column; min-height: 60px; font-size: 0.75rem; color: var(--muted); gap: 2px; }
.tabbar button span { font-size: 1.3rem; }
.tabbar button.active { color: var(--teal); }

.sheet-backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 45%); display: flex; align-items: flex-end; z-index: 20; }
.sheet { width: 100%; max-width: 640px; margin: 0 auto; max-height: 92dvh; overflow-y: auto; background: var(--paper); border-radius: 18px 18px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px; }
.sheet-head { display: flex; justify-content: space-between; align-items: center; }
.sheet-head h2 { margin: 0; font-size: 1.1rem; }
.preview { width: 100%; max-height: 50dvh; object-fit: contain; border-radius: 10px; background: #000; }

label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: var(--muted); }
input[type='text'], textarea { font-size: 16px; padding: 10px; border: 1px solid var(--line); border-radius: 10px; color: var(--ink); background: #fff; }
textarea { min-height: 72px; resize: vertical; }
```

- [ ] **Step 4: 型チェック・テスト・ブラウザ確認**

Run: `npm test && npm run build`
Expected: 全テスト PASS、ビルド成功

`npm run dev` を起動し、ブラウザで `http://localhost:5173/` を開く。
Expected: 下部に「立像 / パネル / 設定」のタブ、立像タブに位置情報バナーが出る。タブを切り替えられる。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: タブ・位置情報フック・共通コンポーネントとスタイルを追加"
```

---

### Task 7: 立像タブ

**Files:**
- Create: `src/components/StatueTab.tsx`, `src/components/SpotCard.tsx`
- Modify: `src/App.tsx`（立像タブの仮表示を `<StatueTab />` に置き換え）

**Interfaces:**
- Consumes: `SPOTS`, `ALL_STATUES`, `applyOverrides`, `Spot`（Task 1）/ `sortByDistance`, `formatDistance`, `directionsUrl`（Task 2）/ `putStatuePhoto`, `putStatueName`, `deleteStatueName`, `putSpotOverride`, `deleteSpotOverride`（Task 3）/ `shareOrDownload`（Task 5）/ `Collection`, `GeoState`, `Position`, `BlobImage`, `PhotoButton`, `GeoBanner`（Task 6）
- Produces: `<StatueTab collection geo />`

- [ ] **Step 1: SpotCard を作成** — `src/components/SpotCard.tsx`

```tsx
import type { Spot } from '../data/spots';
import type { Collection } from '../hooks/useCollection';
import type { Position } from '../hooks/useGeolocation';
import { deleteSpotOverride, deleteStatueName, putSpotOverride, putStatueName, putStatuePhoto } from '../lib/db';
import { directionsUrl, formatDistance } from '../lib/geo';
import { shareOrDownload } from '../lib/share';
import { BlobImage } from './BlobImage';
import { PhotoButton } from './PhotoButton';

type Props = { spot: Spot; distance: number | null; collection: Collection; here: Position | null };

export function SpotCard({ spot, distance, collection, here }: Props) {
  const overridden = collection.spotOverrides.has(spot.id);

  async function fixLocation() {
    if (!here) {
      alert('現在地がまだ取得できていません');
      return;
    }
    const ok = confirm(
      `「${spot.facility} ${spot.floor} ${spot.place}」の位置を現在地（誤差 ±${Math.round(here.accuracy)}m）にしますか？`,
    );
    if (!ok) return;
    await putSpotOverride({ spotId: spot.id, lat: here.lat, lng: here.lng });
    await collection.reload();
  }

  async function resetLocation() {
    await deleteSpotOverride(spot.id);
    await collection.reload();
  }

  async function rename(statueId: string, current: string) {
    const next = prompt('ポケモンの名前（空にすると元に戻ります）', current);
    if (next === null) return;
    const name = next.trim();
    if (name) await putStatueName({ statueId, name });
    else await deleteStatueName(statueId);
    await collection.reload();
  }

  async function savePhoto(statueId: string, blob: Blob) {
    await putStatuePhoto({ statueId, blob, takenAt: Date.now() });
    await collection.reload();
  }

  return (
    <article className="card">
      <div className="spot-head">
        <div>
          <p className="facility">{spot.facility}</p>
          <h2>
            <span className="floor">{spot.floor}</span>
            {spot.place}
          </h2>
        </div>
        {distance !== null && <p className="distance">{formatDistance(distance)}</p>}
      </div>

      <ul className="statues">
        {spot.statues.map((s) => {
          const photo = collection.statuePhotos.get(s.id);
          return (
            <li key={s.id} className={photo ? 'done' : ''}>
              {photo ? (
                <BlobImage blob={photo.blob} alt={s.name} className="thumb" />
              ) : (
                <div className="thumb empty" aria-hidden="true">
                  ?
                </div>
              )}
              <button type="button" className="name" onClick={() => rename(s.id, s.name)}>
                {s.name}
                {s.tentative && <span className="badge">仮</span>}
              </button>
              <div className="row-actions">
                <PhotoButton
                  label={photo ? '撮り直す' : '撮影する'}
                  className={photo ? '' : 'primary'}
                  onPhoto={(b) => savePhoto(s.id, b)}
                />
                {photo && (
                  <button type="button" onClick={() => shareOrDownload(photo.blob, `${s.id}.jpg`)}>
                    保存
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <a className="button" href={directionsUrl(spot)} target="_blank" rel="noopener noreferrer">
          Googleマップで道順
        </a>
        <button type="button" className="link" onClick={fixLocation}>
          ここを正しい位置にする
        </button>
        {overridden && (
          <button type="button" className="link" onClick={resetLocation}>
            位置を元に戻す
          </button>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: StatueTab を作成** — `src/components/StatueTab.tsx`

```tsx
import { useMemo } from 'react';
import { ALL_STATUES, SPOTS, applyOverrides } from '../data/spots';
import type { Collection } from '../hooks/useCollection';
import type { GeoState } from '../hooks/useGeolocation';
import { sortByDistance } from '../lib/geo';
import { GeoBanner } from './GeoBanner';
import { SpotCard } from './SpotCard';

export function StatueTab({ collection, geo }: { collection: Collection; geo: GeoState }) {
  const spots = useMemo(
    () => applyOverrides(SPOTS, collection.spotOverrides, collection.statueNames),
    [collection.spotOverrides, collection.statueNames],
  );
  const sorted = sortByDistance(spots, geo.position);
  const done = ALL_STATUES.filter((s) => collection.statuePhotos.has(s.id)).length;

  return (
    <section className="page">
      <h1>立像</h1>
      <p className="progress">
        {ALL_STATUES.length}体中 <strong>{done}</strong>体 撮影済み
      </p>
      <GeoBanner geo={geo} />
      {sorted.map(({ item, distance }) => (
        <SpotCard key={item.id} spot={item} distance={distance} collection={collection} here={geo.position} />
      ))}
    </section>
  );
}
```

- [ ] **Step 3: App に組み込む** — `src/App.tsx` の立像タブ部分と import を置き換え

```tsx
// import に追加
import { StatueTab } from './components/StatueTab';
// GeoBanner の import は削除

// 置き換え
{tab === 'statues' && <StatueTab collection={collection} geo={geo} />}
```

- [ ] **Step 4: 確認**

Run: `npm test && npm run build`
Expected: PASS・ビルド成功

`npm run dev` → ブラウザの開発者ツールで位置情報を `35.6795, 139.7691`（ミッドタウン付近）に設定して再読み込み。
Expected: ミッドタウン八重洲の 4 スポットが上に並び、距離が「すぐ近く」〜「約30m」、三井タワー付近は「約900m」前後。「撮影する」で画像を選ぶとサムネイルが出て「19体中 1体 撮影済み」になる。名前タップで変更すると「仮」が消える。「Googleマップで道順」で Google マップが新しいタブで開く。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 立像タブ（距離順・道順・撮影・名前編集・位置補正）を追加"
```

---

### Task 8: パネルタブ

**Files:**
- Create: `src/components/PanelTab.tsx`, `src/components/PanelForm.tsx`, `src/components/PanelDetail.tsx`
- Modify: `src/App.tsx`（パネルタブの仮表示を `<PanelTab />` に置き換え）

**Interfaces:**
- Consumes: `Panel`, `putPanel`, `deletePanel`（Task 3）/ `placeUrl`（Task 2）/ `shareOrDownload`（Task 5）/ `Collection`, `getPositionOnce`, `Position`, `BlobImage`, `PhotoButton`, `Sheet`（Task 6）
- Produces: `<PanelTab collection />`

- [ ] **Step 1: PanelForm を作成** — `src/components/PanelForm.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { Position } from '../hooks/useGeolocation';
import { putPanel } from '../lib/db';
import { BlobImage } from './BlobImage';
import { Sheet } from './Sheet';

export type PanelDraft = { blob: Blob; position: Promise<Position | null> };

type Props = { draft: PanelDraft; onClose: () => void; onSaved: () => Promise<void> };

export function PanelForm({ draft, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [pos, setPos] = useState<Position | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void draft.position.then((p) => alive && setPos(p));
    return () => {
      alive = false;
    };
  }, [draft]);

  async function save() {
    setSaving(true);
    await putPanel({
      id: crypto.randomUUID(),
      blob: draft.blob,
      name: name.trim(),
      memo: memo.trim(),
      takenAt: Date.now(),
      ...(pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : {}),
    });
    await onSaved();
  }

  return (
    <Sheet title="パネルを登録" onClose={onClose}>
      <BlobImage blob={draft.blob} alt="撮影した写真" className="preview" />
      <label>
        ポケモン名（任意）
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        メモ（任意）
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <p className="muted">
        {pos === undefined
          ? '📍 現在地を取得中…'
          : pos
            ? `📍 現在地を記録します（誤差 ±${Math.round(pos.accuracy)}m）`
            : '📍 現在地は記録されません'}
      </p>
      <button type="button" className="primary big" disabled={saving} onClick={save}>
        {saving ? '保存中…' : '保存する'}
      </button>
    </Sheet>
  );
}
```

- [ ] **Step 2: PanelDetail を作成** — `src/components/PanelDetail.tsx`

```tsx
import { useState } from 'react';
import { deletePanel, putPanel, type Panel } from '../lib/db';
import { placeUrl } from '../lib/geo';
import { shareOrDownload } from '../lib/share';
import { BlobImage } from './BlobImage';
import { Sheet } from './Sheet';

type Props = { panel: Panel; onClose: () => void; onChanged: () => Promise<void> };

export function PanelDetail({ panel, onClose, onChanged }: Props) {
  const [name, setName] = useState(panel.name);
  const [memo, setMemo] = useState(panel.memo);
  const dirty = name.trim() !== panel.name || memo.trim() !== panel.memo;

  async function save() {
    await putPanel({ ...panel, name: name.trim(), memo: memo.trim() });
    await onChanged();
  }

  async function remove() {
    if (!confirm('このパネルの記録を削除しますか？（元に戻せません）')) return;
    await deletePanel(panel.id);
    await onChanged();
  }

  return (
    <Sheet title={panel.name || 'パネル'} onClose={onClose}>
      <BlobImage blob={panel.blob} alt={panel.name || 'パネル'} className="preview" />
      <p className="muted">{new Date(panel.takenAt).toLocaleString('ja-JP')}</p>
      <label>
        ポケモン名
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        メモ
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <div className="actions">
        {dirty && (
          <button type="button" className="primary" onClick={save}>
            変更を保存
          </button>
        )}
        <button type="button" onClick={() => shareOrDownload(panel.blob, `panel-${panel.id}.jpg`)}>
          写真アプリに保存
        </button>
        {panel.lat !== undefined && panel.lng !== undefined && (
          <a
            className="button"
            href={placeUrl({ lat: panel.lat, lng: panel.lng })}
            target="_blank"
            rel="noopener noreferrer"
          >
            地図で場所を見る
          </a>
        )}
        <button type="button" className="danger" onClick={remove}>
          削除
        </button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 3: PanelTab を作成** — `src/components/PanelTab.tsx`

```tsx
import { useState } from 'react';
import type { Collection } from '../hooks/useCollection';
import { getPositionOnce } from '../hooks/useGeolocation';
import type { Panel } from '../lib/db';
import { BlobImage } from './BlobImage';
import { PanelDetail } from './PanelDetail';
import { PanelForm, type PanelDraft } from './PanelForm';
import { PhotoButton } from './PhotoButton';

export function PanelTab({ collection }: { collection: Collection }) {
  const [draft, setDraft] = useState<PanelDraft | null>(null);
  const [selected, setSelected] = useState<Panel | null>(null);

  return (
    <section className="page">
      <h1>パネル</h1>
      <p className="progress">
        <strong>{collection.panels.length}</strong>体 発見
      </p>
      <PhotoButton
        label="＋ 見つけた！"
        className="primary big"
        onPhoto={(blob) => setDraft({ blob, position: getPositionOnce() })}
      />
      {collection.panels.length === 0 ? (
        <p className="empty-text">街で見つけたパネルを撮影して集めよう</p>
      ) : (
        <ul className="grid">
          {collection.panels.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setSelected(p)}>
                <BlobImage blob={p.blob} alt={p.name || 'パネル'} />
                <span>{p.name || '名前なし'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {draft && (
        <PanelForm
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={async () => {
            setDraft(null);
            await collection.reload();
          }}
        />
      )}
      {selected && (
        <PanelDetail
          panel={selected}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            setSelected(null);
            await collection.reload();
          }}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: App に組み込む** — `src/App.tsx`

```tsx
// import に追加
import { PanelTab } from './components/PanelTab';

// 置き換え
{tab === 'panels' && <PanelTab collection={collection} />}
```

- [ ] **Step 5: 確認**

Run: `npm test && npm run build`
Expected: PASS・ビルド成功

`npm run dev` → パネルタブで「＋ 見つけた！」→ 画像を選ぶ → 登録シートで名前を入れて保存。
Expected: グリッドに追加され「1体 発見」。タップで詳細が開き、名前の変更・削除ができる。位置ありなら「地図で場所を見る」が出る。再読み込みしても残っている。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: パネルタブ（撮影・登録・一覧・詳細編集・削除）を追加"
```

---

### Task 9: 設定タブ（バックアップ・データ保護）

**Files:**
- Create: `src/components/SettingsTab.tsx`
- Modify: `src/App.tsx`（設定タブの仮表示を `<SettingsTab />` に置き換え）

**Interfaces:**
- Consumes: `exportBackup`, `importBackup`, `backupFileName`（Task 4）/ `shareOrDownload`（Task 5）/ `Collection`（Task 6）
- Produces: `<SettingsTab collection />`

- [ ] **Step 1: SettingsTab を作成** — `src/components/SettingsTab.tsx`

書き出しは 2 段階（作成 → 保存ボタン）にする。iOS の共有シートはタップ直後でないと開けず、ZIP 作成を待つとタップ扱いが切れるため。

```tsx
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Collection } from '../hooks/useCollection';
import { backupFileName, exportBackup, importBackup } from '../lib/backup';
import { shareOrDownload } from '../lib/share';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function SettingsTab({ collection }: { collection: Collection }) {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<{ blob: Blob; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  async function createBackup() {
    setBusy(true);
    try {
      setBackup({ blob: await exportBackup(), name: backupFileName() });
    } catch (e) {
      alert(`バックアップを作れませんでした: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const r = await importBackup(new Uint8Array(await file.arrayBuffer()));
      await collection.reload();
      setBackup(null); // 作成済みバックアップは古くなるので作り直してもらう
      alert(`読み込みました（立像 ${r.statuePhotos}枚・パネル ${r.panels}枚）`);
    } catch (err) {
      alert(`読み込めませんでした: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const photoCount = collection.statuePhotos.size + collection.panels.length;

  return (
    <section className="page">
      <h1>設定</h1>

      <div className="card">
        <h2>バックアップ</h2>
        <p>写真 {photoCount}枚と記録を 1 つのファイルにまとめます。共有シートで「"ファイル"に保存」を選んでください。</p>
        <div className="actions">
          {backup ? (
            <button type="button" className="primary" onClick={() => shareOrDownload(backup.blob, backup.name)}>
              {backup.name} を保存
            </button>
          ) : (
            <button type="button" className="primary" disabled={busy} onClick={createBackup}>
              {busy ? '作成中…' : 'バックアップを作成'}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            バックアップを読み込む
          </button>
          <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={handleImport} />
        </div>
      </div>

      <div className="card">
        <h2>データの保護</h2>
        <ul>
          <li>
            ホーム画面から起動：
            {isStandalone() ? 'はい ✅' : 'いいえ ⚠️ 共有ボタン →「ホーム画面に追加」から起動してください'}
          </li>
          <li>データの永続化：{persisted === null ? '不明' : persisted ? '有効 ✅' : '未許可 ⚠️'}</li>
        </ul>
        <p className="muted">
          Safari の「履歴と Web サイトデータを消去」を行うと写真も消えます。こまめにバックアップしてください。
        </p>
      </div>

      <div className="card">
        <h2>写真アプリに保存するには</h2>
        <p>各写真の「保存」ボタン → 共有シートの「画像を保存」を選びます。</p>
      </div>

      <p className="muted">
        イベント情報：
        <a href="https://mitsui-shopping-park.com/urban/legend-research/" target="_blank" rel="noopener noreferrer">
          レジェンドリサーチ公式サイト
        </a>
      </p>
    </section>
  );
}
```

- [ ] **Step 2: App に組み込む** — `src/App.tsx`

```tsx
// import に追加
import { SettingsTab } from './components/SettingsTab';

// 置き換え
{tab === 'settings' && <SettingsTab collection={collection} />}
```

- [ ] **Step 3: 確認**

Run: `npm test && npm run build`
Expected: PASS・ビルド成功

`npm run dev` → 設定タブで「バックアップを作成」→「backup-….zip を保存」でファイルがダウンロードされる。開発者ツールの Application → IndexedDB → `legend-research` を削除して再読み込み → 「バックアップを読み込む」でその ZIP を選ぶ。
Expected: 「読み込みました（立像 N枚・パネル M枚）」と出て、写真が元に戻る。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 設定タブ（バックアップ・データ保護の案内）を追加"
```

---

### Task 10: PWA 化・アイコン・GitHub Pages デプロイ設定

**Files:**
- Create: `public/icon.svg`（+ `npm run icons` で生成される PNG / ico）
- Create: `.github/workflows/deploy.yml`, `README.md`
- Modify: `vite.config.ts`（VitePWA 追加）, `index.html`（アイコン・iOS 用 meta）

**Interfaces:**
- Consumes: 既存のビルド設定
- Produces: `dist/` に `manifest.webmanifest` と `sw.js`。`BASE_PATH` 指定時は全 URL がその配下になる。

- [ ] **Step 1: アイコン原画を作成** — `public/icon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0b5566"/>
  <circle cx="226" cy="226" r="118" fill="none" stroke="#fdf6e9" stroke-width="40"/>
  <line x1="312" y1="312" x2="410" y2="410" stroke="#f5d90a" stroke-width="48" stroke-linecap="round"/>
  <circle cx="226" cy="226" r="34" fill="#f5d90a"/>
</svg>
```

Run: `npm run icons`
Expected: `public/` に `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` ができる。

- [ ] **Step 2: VitePWA を設定** — `vite.config.ts` を置き換え

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'レジェンドリサーチ・コレクター',
        short_name: 'レジェリサ',
        description: '日本橋・八重洲のポケモン立像とパネルの写真を集めるアプリ',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#0b5566',
        background_color: '#fdf6e9',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: index.html にアイコンと iOS 用 meta を追加** — `<head>` 内、`<title>` の前に

```html
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="レジェリサ" />
```

- [ ] **Step 4: base 付きビルドを確認**

Run: `BASE_PATH=/pokemon-researcher/ npm run build && grep -o 'href="[^"]*"' dist/index.html && ls dist`
Expected: `href` がすべて `/pokemon-researcher/` で始まる（`manifest.webmanifest` を含む）。`dist/` に `sw.js`, `manifest.webmanifest`, アイコンがある。
もしアイコンの `href` に base が付いていなければ、`index.html` の該当 `href` から先頭の `/` を外した相対パス（`favicon.ico` など）に直して再確認する。

- [ ] **Step 5: GitHub Actions ワークフロー** — `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 6: README** — `README.md`

````markdown
# レジェンドリサーチ・コレクター

日本橋・八重洲「ポケモン レジェンドリサーチ」（2026/9/9〜11/29）の立像 19 体とパネルの写真を集める iPhone 向け Web アプリ。
写真と記録は iPhone の中（IndexedDB）にだけ保存されます。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173/
npm test
npm run build
```

位置情報とカメラは https か localhost でしか動きません。iPhone 実機での確認は GitHub Pages に公開してから行います。

## 公開（GitHub Pages）

1. GitHub に空のリポジトリを作る（例: `pokemon-researcher`）
2. `git remote add origin git@github.com:<ユーザー名>/pokemon-researcher.git && git push -u origin main`
3. リポジトリの Settings → Pages → Source を「GitHub Actions」にする
4. main に push するたびに `https://<ユーザー名>.github.io/pokemon-researcher/` に公開される

## iPhone での使い方

1. Safari で公開 URL を開く
2. 共有ボタン →「ホーム画面に追加」（7 日でデータが消える仕様を避けるため必須）
3. ホーム画面のアイコンから起動し、位置情報とカメラを許可
4. 設定タブからこまめにバックアップを「ファイル」に保存

## データ

- 立像の場所と名前: `src/data/spots.ts`（座標は概算。アプリ内で位置補正・名前変更が可能）
- 出典: https://mitsui-shopping-park.com/urban/legend-research/
````

- [ ] **Step 7: 最終確認**

Run: `npm test && npm run build && npm run preview`
Expected: 全テスト PASS。`http://localhost:4173/` で開き、開発者ツールの Application → Manifest にアプリ名とアイコン、Service Workers に `sw.js` が登録されている。オフラインにして再読み込みしても画面が出る。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: PWA 化・アイコン・GitHub Pages デプロイ設定を追加"
```
