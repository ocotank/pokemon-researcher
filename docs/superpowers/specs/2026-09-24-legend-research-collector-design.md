# レジェンドリサーチ・コレクター 設計書

- 作成日: 2026-09-24
- 対象イベント: 伝説のポケモンと出会う レジェンドリサーチ in 日本橋＆八重洲（2026/9/9〜11/29）
  - 公式: https://mitsui-shopping-park.com/urban/legend-research/

## 1. 目的

iPhone（Safari）で使う個人用 Web アプリ。

- 立像 19 体（9 スポット）について、現在地から近い順に表示し、階数と Google マップの道順を示す。立像ごとに写真を撮って集める。
- 街中のパネル・装飾（100 体以上、場所非公開）を見つけたら、写真と現在地を記録して集める。

写真・記録はすべて端末内に保存し、サーバーには送らない。AI（Jev 等）は使わない。

## 2. 非目的（やらないこと）

- 複数人での共有、クラウド同期、ログイン
- 写真に写ったポケモンの自動判定
- 屋内の階数判定（GPS では不可能なので、階数はデータとして表示するだけ）
- Android 最適化（動けば良いが、検証対象は iPhone Safari のみ）

## 3. 技術構成

| 用途 | 採用 |
|---|---|
| ビルド | Vite |
| UI | React + TypeScript |
| PWA（ホーム画面追加・オフライン） | vite-plugin-pwa（registerType: autoUpdate） |
| 端末内保存 | IndexedDB（ラッパー: `idb`） |
| バックアップ ZIP | `fflate` |
| テスト | Vitest（+ fake-indexeddb） |
| 公開 | GitHub Pages（GitHub Actions で main push 時にデプロイ）。Vite の `base` をリポジトリ名に合わせる |

Astro は不採用。全画面が端末 API（位置・カメラ・IndexedDB）依存のクライアントアプリで、Astro の静的生成の利点が活きないため。

## 4. 画面構成

下部タブで 3 画面を切り替える（ルーターは使わず state で切替）。

### 4.1 立像タブ

- ヘッダー: 「19 体中 N 体 撮影済み」、現在地の取得状態（精度 ±Xm）
- スポットカードを現在地からの距離の昇順で並べる。位置が取れない場合は定義順。
- スポットカード:
  - 施設名、階数、場所名（例: 東京ミッドタウン八重洲 / B1F / YAESU BASE）
  - 距離（例: 約 120m、1km 以上は「1.2km」）
  - 「Google マップで道順」ボタン → `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=walking` を新規タブで開く
  - 「ここを正しい位置にする」ボタン → 現在地でスポット座標を上書き（端末内に保存、リセット可）
  - 立像ごとの行: 名前（仮の名前には「仮」バッジ、タップで編集）、サムネイル、撮影ボタン（撮影済みなら撮り直し）

### 4.2 パネルタブ

- ヘッダー: 「N 体 発見」
- 「＋見つけた！」ボタン → カメラ起動 → 撮影後に登録シート（ポケモン名・メモは任意、現在地と時刻は自動）
- 写真グリッド（新しい順）。タップで詳細（拡大表示・名前/メモ編集・削除・写真アプリへ保存・Google マップでその場所を開く）

### 4.3 設定タブ

- バックアップを書き出す（ZIP をダウンロード。iPhone では「ファイル」に保存）
- バックアップを読み込む（ZIP を選択 → 既存データとマージ、同じ ID は上書き）
- データ保護状態: `navigator.storage.persisted()` の結果と、ホーム画面追加の案内
- 写真アプリに保存する方法の案内

## 5. データ

### 5.1 固定データ `src/data/spots.ts`

```ts
type Spot = {
  id: string;          // 例 "midtown-b1f"
  facility: string;    // "東京ミッドタウン八重洲"
  floor: string;       // "B1F"
  place: string;       // "YAESU BASE"
  lat: number; lng: number; // 建物位置からの概算
  statues: { id: string; name: string; tentative: boolean }[];
};
```

9 スポット・19 体（公式 MAP より）:

| スポット | 階 | 場所 | 立像（仮=シルエットからの推測） |
|---|---|---|---|
| COREDO室町テラス | B1F | 郵便局前 | ホウオウ(仮)、ルギア(仮) |
| COREDO室町テラス | 1F | エスカレーターピロティ | 未確認 ×2 |
| COREDO室町1・2 | B1F | 地下歩道 | ディアルガ(仮)、パルキア(仮) |
| 日本橋三井タワー | 1F | アトリウム | フシギバナ、リザードン、カメックス |
| COREDO室町3付近 | B1F | 日本橋案内所／わくわく広場前 | 未確認 ×2 |
| 東京ミッドタウン八重洲 | B1F | YAESU BASE | 未確認 ×2 |
| 東京ミッドタウン八重洲 | 1F | アトリウム | ゼルネアス、イベルタル |
| 東京ミッドタウン八重洲 | 2F | Hacoa DIRECT STORE横スペース | 未確認 ×2 |
| 東京ミッドタウン八重洲 | 3F | エスカレーター下 | ソルガレオ(仮)、ルナアーラ(仮) |

名前はユーザーが現地で編集でき、編集後は「仮」バッジが消える。

### 5.2 IndexedDB（DB 名 `legend-research`, version 1）

| store | key | 値 |
|---|---|---|
| `statuePhotos` | statueId | `{ statueId, blob, takenAt }` |
| `panels` | id (uuid) | `{ id, blob, name, memo, lat?, lng?, accuracy?, takenAt }` |
| `statueNames` | statueId | `{ statueId, name }`（ユーザー編集した名前） |
| `spotOverrides` | spotId | `{ spotId, lat, lng }` |

起動時に `navigator.storage.persist()` を要求する。

### 5.3 バックアップ ZIP 形式

```
backup-YYYYMMDD-HHmm.zip
├── data.json      // { version: 1, exportedAt, statuePhotos: [{statueId, takenAt, file}], panels: [...], statueNames, spotOverrides }
└── photos/
    ├── statue-<statueId>.jpg
    └── panel-<id>.jpg
```

## 6. 写真の扱い

- `<input type="file" accept="image/*" capture="environment">` でカメラ起動
- Canvas で長辺 1600px の JPEG（品質 0.85）に縮小して保存。`createImageBitmap` の `imageOrientation: 'from-image'` で向きを補正
- 写真アプリへの保存: `navigator.share({ files: [file] })` で共有シートを開き、ユーザーが「画像を保存」を選ぶ。`share` 非対応ならダウンロードリンクで代替

## 7. 位置情報

- `navigator.geolocation.watchPosition`（enableHighAccuracy: true）。タブ表示中のみ監視
- 距離はハーバーサイン式で計算（純粋関数 `distanceMeters(a, b)`）
- 拒否・取得失敗時: バナーで理由を表示し、距離なし・定義順で表示。他の機能は通常どおり使える
- パネル登録時に位置が無ければ位置なしで保存する

## 8. モジュール分割

```
src/
  data/spots.ts          固定データ
  lib/geo.ts             distanceMeters, sortSpotsByDistance, formatDistance, directionsUrl
  lib/db.ts              IndexedDB アクセス（CRUD）
  lib/image.ts           縮小・JPEG 化
  lib/backup.ts          ZIP 書き出し・読み込み
  hooks/useGeolocation.ts
  components/            StatueTab, SpotCard, PanelTab, PanelDetail, SettingsTab, TabBar
  App.tsx, main.tsx
```

## 9. テスト方針

- Vitest で純粋ロジックをテスト: `geo.ts`（距離・並び替え・表示・URL）、`backup.ts`（書き出し→読み込みの往復で内容一致）、`db.ts`（fake-indexeddb で CRUD）
- UI はブラウザで手動確認（Chrome の位置情報エミュレーション）→ 最終確認は実機 iPhone

## 10. 公開手順（実装後）

1. GitHub にリポジトリ作成・push
2. `vite.config.ts` の `base` を `/<リポジトリ名>/` に設定
3. GitHub Actions ワークフロー（`.github/workflows/deploy.yml`）で build → Pages へデプロイ
4. iPhone Safari で開き「ホーム画面に追加」

## 11. 既知のリスク

- スポット座標は概算。地下・高層階は GPS 誤差が大きい → 補正ボタンで対処
- iOS Safari はホーム画面未追加だと 7 日間未使用でサイトデータが消える可能性 → ホーム画面追加を案内＋バックアップ
- 未確認の立像名 → 現地で編集
