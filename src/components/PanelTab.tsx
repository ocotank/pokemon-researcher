import { useState } from 'react';
import type { Collection } from '../hooks/useCollection';
import { getPositionOnce } from '../hooks/useGeolocation';
import { type Panel, putPanel } from '../lib/db';
import { errorText } from '../lib/errors';
import { BlobImage } from './BlobImage';
import { PanelDetail } from './PanelDetail';
import { type PanelDraft, PanelForm } from './PanelForm';
import { type Photo, PhotoButton } from './PhotoButton';

export function PanelTab({ collection }: { collection: Collection }) {
  const [draft, setDraft] = useState<PanelDraft | null>(null);
  const [selected, setSelected] = useState<Panel | null>(null);

  // 1 枚なら名前とメモを入力するフォームを出す。
  // 複数枚はまとめて登録し、名前やメモは後から各パネルの詳細で入れてもらう。
  async function addPhotos(photos: Photo[]) {
    const first = photos[0];
    if (!first) return;
    if (photos.length === 1) {
      setDraft({ ...first, takenAt: Date.now(), position: getPositionOnce() });
      return;
    }
    const position = await getPositionOnce();
    const takenAt = Date.now();
    try {
      for (const photo of photos) {
        await putPanel({
          id: crypto.randomUUID(),
          ...photo,
          name: '',
          memo: '',
          takenAt,
          ...(position ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy } : {}),
        });
      }
    } catch (e) {
      alert(`保存できませんでした: ${errorText(e)}`);
      return;
    }
    try {
      await collection.reload();
    } catch {
      alert('表示を更新できませんでした。アプリを開き直してください');
    }
  }

  return (
    <section className="page">
      <h1>パネル</h1>
      <p className="progress">
        <strong>{collection.panels.length}</strong>体 発見
      </p>
      <PhotoButton label="＋ 見つけた！" className="primary big" multiple onPhotos={addPhotos} />
      {collection.panels.length === 0 ? (
        <p className="empty-text">まだポケモンを見つけてないよ！</p>
      ) : (
        <ul className="grid">
          {collection.panels.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setSelected(p)}>
                <BlobImage blob={p.thumb ?? p.blob} alt={p.name || 'パネル'} />
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
            await collection.reload();
            setDraft(null);
          }}
        />
      )}
      {selected && (
        <PanelDetail
          panel={selected}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await collection.reload();
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
