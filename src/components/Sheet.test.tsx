// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('バックドロップの閉じるボタンをクリックするとonCloseを呼ぶ', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="タイトル" onClose={onClose}>
        <p>内容</p>
      </Sheet>,
    );

    fireEvent.click(document.querySelector('.sheet-backdrop-button') as HTMLButtonElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ダイアログの内容をクリックしてもonCloseを呼ばない', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="タイトル" onClose={onClose}>
        <p>内容</p>
      </Sheet>,
    );

    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'タイトル' })).getByRole('heading', { name: 'タイトル' }),
    );

    expect(onClose).not.toHaveBeenCalled();
  });

  it('ヘッダーの閉じるボタンをクリックするとonCloseを呼ぶ', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="タイトル" onClose={onClose}>
        <p>内容</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'タイトル' });

    fireEvent.click(within(dialog).getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
