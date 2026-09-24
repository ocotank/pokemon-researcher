import { describe, expect, it } from 'vitest';
import { directionsUrl, distanceMeters, formatDistance, placeUrl, sortByDistance } from './geo';

describe('distanceMeters', () => {
  it('同じ地点は 0', () => {
    expect(distanceMeters({ lat: 35.68, lng: 139.77 }, { lat: 35.68, lng: 139.77 })).toBe(0);
  });

  it('緯度 1 度はおよそ 111,195m', () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(Math.abs(d - 111195)).toBeLessThan(1);
  });

  it('三井タワー → ミッドタウン八重洲はおよそ 1km', () => {
    const d = distanceMeters({ lat: 35.6866, lng: 139.7731 }, { lat: 35.6793, lng: 139.769 });
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(1000);
  });
});

describe('formatDistance', () => {
  it.each([
    [5, 'すぐ近く'],
    [123, '約120m'],
    [994, '約990m'],
    [996, '約1.0km'],
    [1234, '約1.2km'],
  ])('%d m → %s', (m, expected) => {
    expect(formatDistance(m)).toBe(expected);
  });
});

describe('sortByDistance', () => {
  const a = { id: 'a', lat: 35.6866, lng: 139.7731 };
  const b = { id: 'b', lat: 35.6793, lng: 139.769 };

  it('現在地が無ければ元の順・距離 null', () => {
    expect(sortByDistance([a, b], null)).toEqual([
      { item: a, distance: null },
      { item: b, distance: null },
    ]);
  });

  it('現在地から近い順に並べる', () => {
    const out = sortByDistance([a, b], { lat: 35.6795, lng: 139.7691 });
    expect(out.map((x) => x.item.id)).toEqual(['b', 'a']);
    expect(out[0].distance).toBeLessThan(out[1].distance!);
  });
});

describe('URL', () => {
  it('徒歩の道順 URL', () => {
    expect(directionsUrl({ lat: 35.1, lng: 139.2 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=35.1,139.2&travelmode=walking',
    );
  });

  it('場所の URL', () => {
    expect(placeUrl({ lat: 35.1, lng: 139.2 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=35.1,139.2',
    );
  });
});
