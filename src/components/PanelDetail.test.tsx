// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePanel, getAllPanels, type Panel, putPanel, resetDatabase } from '../lib/db';
import { PanelDetail } from './PanelDetail';

const panel: Panel = {
  id: 'panel-1',
  blob: new Blob(['panel'], { type: 'image/jpeg' }),
  name: 'ピカチュウ',
  memo: 'メモ',
  takenAt: 1,
};

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

describe('PanelDetail', () => {
  it('削除確認をOKにするとDBから消えてonChangedを呼ぶ', async () => {
    await putPanel(panel);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onChanged = vi.fn(async () => {});
    render(<PanelDetail panel={panel} onClose={vi.fn()} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(async () => {
      expect(await getAllPanels()).toEqual([]);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  it('削除確認をキャンセルするとDBから消さない', async () => {
    await putPanel(panel);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onChanged = vi.fn(async () => {});
    render(<PanelDetail panel={panel} onClose={vi.fn()} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(async () => {
      expect(await getAllPanels()).toHaveLength(1);
    });
    expect(onChanged).not.toHaveBeenCalled();
    await deletePanel(panel.id);
  });
});
