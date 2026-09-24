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
