// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GeoBanner } from './GeoBanner';

describe('GeoBanner', () => {
  it('位置取得済みの表示を出す', () => {
    render(<GeoBanner geo={{ status: 'ok', position: { lat: 35.68, lng: 139.77, accuracy: 14 } }} />);

    expect(screen.getByText('📍 現在地を取得済み（誤差 ±14m）')).toBeTruthy();
  });

  it('位置取得中の表示を出す', () => {
    render(<GeoBanner geo={{ status: 'locating', position: null }} />);

    expect(screen.getByText('📍 現在地を取得中…')).toBeTruthy();
  });

  it('位置が無い拒否状態では距離なしの案内を出す', () => {
    render(<GeoBanner geo={{ status: 'denied', position: null, message: '位置情報が許可されていません' }} />);

    expect(screen.getByText(/位置情報が許可されていません。距離なしで表示しています/)).toBeTruthy();
  });
});
