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
