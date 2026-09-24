import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import type { Collection } from '../hooks/useCollection';
import { backupFileName, exportBackup, importBackup } from '../lib/backup';
import { errorText } from '../lib/errors';
import { shareOrDownload } from '../lib/share';

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
        <p>
          写真 {photoCount}枚と記録を 1 つのファイルにまとめます。共有シートで「"ファイル"に保存」を選んでください。
        </p>
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
          Safari の「履歴と Web サイトデータを消去」を行うと写真も消えます。こまめにバックアップしてください。 Safari
          のタブとホーム画面アプリは保存場所が別です。Safari で撮った写真はホーム画面アプリに出ないので、バックアップ →
          読み込みで移してください。
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
