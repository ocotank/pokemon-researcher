// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_STATUES } from '../data/spots';
import type { Collection } from '../hooks/useCollection';
import type { GeoState } from '../hooks/useGeolocation';
import { getAllStatuePhotos, putStatuePhoto, resetDatabase, type StatuePhoto } from '../lib/db';
import { StatueTab } from './StatueTab';

const geoWithPosition: GeoState = {
  status: 'ok',
  position: { lat: 35.6793, lng: 139.769, accuracy: 10 },
};
const geoWithoutPosition: GeoState = { status: 'denied', position: null, message: '位置情報がありません' };

async function createCollection(): Promise<Collection> {
  const photos = await getAllStatuePhotos();
  return {
    statuePhotos: new Map(
      photos.map((photo) => [
        photo.statueId,
        {
          ...photo,
          blob: new Blob(['photo'], { type: 'image/jpeg' }),
          thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
        },
      ]),
    ),
    panels: [],
    statueNames: new Map(),
    spotOverrides: new Map(),
    loaded: true,
    reload: vi.fn(async () => {}),
  };
}

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

describe('StatueTab', () => {
  it('ミッドタウン八重洲付近では最初に東京ミッドタウン八重洲を表示し距離を表示する', async () => {
    render(<StatueTab collection={await createCollection()} geo={geoWithPosition} />);

    const firstCard = screen.getAllByRole('article')[0];
    expect(within(firstCard).getByText('東京ミッドタウン八重洲')).toBeTruthy();
    expect(within(firstCard).getByText('すぐ近く')).toBeTruthy();
  });

  it('位置が無いときは定義順で距離を表示しない', async () => {
    render(<StatueTab collection={await createCollection()} geo={geoWithoutPosition} />);

    const firstCard = screen.getAllByRole('article')[0];
    expect(within(firstCard).getByText('COREDO室町テラス')).toBeTruthy();
    expect(firstCard.querySelector('.distance')).toBeNull();
  });

  it('撮影済みの数を19体中2体撮影済みと表示する', async () => {
    const photo: Omit<StatuePhoto, 'statueId'> = { blob: new Blob(['photo']), takenAt: 1 };
    await putStatuePhoto({ statueId: ALL_STATUES[0].id, ...photo });
    await putStatuePhoto({ statueId: ALL_STATUES[1].id, ...photo });

    render(<StatueTab collection={await createCollection()} geo={geoWithoutPosition} />);

    expect(document.querySelector('.progress')?.textContent).toBe('19体中 2体 撮影済み');
  });
});
