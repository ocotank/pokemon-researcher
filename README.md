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
