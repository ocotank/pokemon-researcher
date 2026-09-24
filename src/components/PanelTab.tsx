import { useState } from 'react';
import type { Collection } from '../hooks/useCollection';
import { getPositionOnce } from '../hooks/useGeolocation';
import type { Panel } from '../lib/db';
import { BlobImage } from './BlobImage';
import { PanelDetail } from './PanelDetail';
import { type PanelDraft, PanelForm } from './PanelForm';
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
        onPhoto={({ blob, thumb }) => setDraft({ blob, thumb, takenAt: Date.now(), position: getPositionOnce() })}
      />
      {collection.panels.length === 0 ? (
        <p className="empty-text">街で見つけたパネルを撮影して集めよう</p>
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
