// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Position } from '../hooks/useGeolocation';
import { getAllPanels, resetDatabase } from '../lib/db';
import { type PanelDraft, PanelForm } from './PanelForm';

const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' });

function createDraft(position: Promise<Position | null>, takenAt = 1): PanelDraft {
  return { blob: jpeg('panel'), thumb: jpeg('thumb'), takenAt, position };
}

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

describe('PanelForm', () => {
  it('位置取得中に保存ボタンを3回押してもパネルは1件だけ保存される', async () => {
    let resolvePosition: (position: Position | null) => void = () => {};
    const position = new Promise<Position | null>((resolve) => {
      resolvePosition = resolve;
    });
    const onSaved = vi.fn(async () => {});
    render(<PanelForm draft={createDraft(position)} onClose={vi.fn()} onSaved={onSaved} />);

    const saveButton = screen.getByRole('button', { name: '現在地を取得してから保存…' });
    // fireEvent は 1 回ごとに再描画してボタンが disabled になるため、
    // 再描画前に連続タップが届く実機の状況を 1 つの act 内のクリックで再現する
    await act(async () => {
      saveButton.click();
      saveButton.click();
      saveButton.click();
    });
    resolvePosition(null);

    await waitFor(async () => {
      expect(await getAllPanels()).toHaveLength(1);
    });
    await Promise.resolve();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('位置取得後に緯度経度付きで保存し、取得中は案内を表示する', async () => {
    let resolvePosition: (position: Position | null) => void = () => {};
    const position = new Promise<Position | null>((resolve) => {
      resolvePosition = resolve;
    });
    render(<PanelForm draft={createDraft(position)} onClose={vi.fn()} onSaved={vi.fn(async () => {})} />);

    expect(screen.getByRole('button', { name: '現在地を取得してから保存…' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '現在地を取得してから保存…' }));
    resolvePosition({ lat: 35.68, lng: 139.77, accuracy: 12 });

    await waitFor(async () => {
      const panels = await getAllPanels();
      expect(panels[0]).toMatchObject({ lat: 35.68, lng: 139.77, accuracy: 12 });
    });
  });

  it('位置が取得できない場合は位置なしで保存される', async () => {
    render(<PanelForm draft={createDraft(Promise.resolve(null))} onClose={vi.fn()} onSaved={vi.fn(async () => {})} />);

    fireEvent.click(screen.getByRole('button', { name: '現在地を取得してから保存…' }));

    await waitFor(async () => {
      const panels = await getAllPanels();
      expect(panels[0]).not.toHaveProperty('lat');
      expect(panels[0]).not.toHaveProperty('lng');
    });
  });

  it('閉じるボタンでキャンセルなら閉じず、確認なら閉じる', () => {
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, 'confirm');
    render(<PanelForm draft={createDraft(Promise.resolve(null))} onClose={onClose} onSaved={vi.fn(async () => {})} />);
    const sheet = screen.getByRole('dialog');
    const closeButton = within(sheet).getByRole('button', { name: '閉じる' });

    confirm.mockReturnValue(false);
    fireEvent.click(closeButton);
    expect(confirm).toHaveBeenCalledWith('撮影した写真を破棄しますか？');
    expect(onClose).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('draftの撮影時刻を保存する', async () => {
    const takenAt = 1_758_686_400_000;
    render(
      <PanelForm
        draft={createDraft(Promise.resolve(null), takenAt)}
        onClose={vi.fn()}
        onSaved={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '現在地を取得してから保存…' }));

    await waitFor(async () => {
      expect((await getAllPanels())[0].takenAt).toBe(takenAt);
    });
  });
});
