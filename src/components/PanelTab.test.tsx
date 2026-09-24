// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Collection } from '../hooks/useCollection';
import { getAllPanels, resetDatabase } from '../lib/db';
import { PanelTab } from './PanelTab';

const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' });

function createCollection(panels: Collection['panels'] = []): Collection {
  return {
    statuePhotos: new Map(),
    spotPhotos: new Map(),
    panels,
    statueNames: new Map(),
    spotOverrides: new Map(),
    loaded: true,
    reload: vi.fn(async () => {}),
  };
}

const panel = (id: string, name = '') => ({ id, blob: jpeg(id), thumb: jpeg(id), name, memo: '', takenAt: 1 });

// 画像のリサイズは canvas に依存するので、テストでは素通しにする
vi.mock('../lib/image', () => ({
  toResizedJpeg: vi.fn(async (file: Blob) => file),
  toThumbnailJpeg: vi.fn(async (blob: Blob) => blob),
}));

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
});

describe('PanelTab', () => {
  it('登録が無いときはまだポケモンを見つけてないよと表示する', () => {
    render(<PanelTab collection={createCollection()} />);

    expect(screen.getByText('まだポケモンを見つけてないよ！')).toBeTruthy();
  });

  it('登録があるときは一覧を出し、空のメッセージは出さない', () => {
    render(<PanelTab collection={createCollection([panel('p1', 'ピカチュウ')])} />);

    expect(screen.queryByText('まだポケモンを見つけてないよ！')).toBeNull();
    expect(screen.getByText('ピカチュウ')).toBeTruthy();
  });

  it('写真を複数選ぶとフォームを出さずにまとめて登録する', async () => {
    const collection = createCollection();
    const { container } = render(<PanelTab collection={collection} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    fireEvent.change(input, {
      target: { files: [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg'), new File(['c'], 'c.jpg')] },
    });

    await waitFor(async () => {
      expect(await getAllPanels()).toHaveLength(3);
    });
    expect(collection.reload).toHaveBeenCalled();
    expect(screen.queryByText('パネルを登録')).toBeNull();
  });

  it('写真が1枚のときは登録フォームを出す', async () => {
    render(<PanelTab collection={createCollection()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['a'], 'a.jpg')] } });

    await waitFor(() => {
      expect(screen.getByText('パネルを登録')).toBeTruthy();
    });
    expect(await getAllPanels()).toHaveLength(0);
  });

  it('カメラを直接起動しないよう capture を付けない', () => {
    const { container } = render(<PanelTab collection={createCollection()} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.getAttribute('capture')).toBeNull();
    expect(input.getAttribute('accept')).toBe('image/*');
  });
});
