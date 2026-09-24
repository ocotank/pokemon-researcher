import { useMemo } from 'react';
import { ALL_STATUES, applyOverrides, SPOTS } from '../data/spots';
import type { Collection } from '../hooks/useCollection';
import type { GeoState } from '../hooks/useGeolocation';
import { sortByDistance } from '../lib/geo';
import { GeoBanner } from './GeoBanner';
import { SpotCard } from './SpotCard';

export function StatueTab({ collection, geo }: { collection: Collection; geo: GeoState }) {
  const spots = useMemo(
    () => applyOverrides(SPOTS, collection.spotOverrides, collection.statueNames),
    [collection.spotOverrides, collection.statueNames],
  );
  const sorted = sortByDistance(spots, geo.position);
  const done = ALL_STATUES.filter((s) => collection.statuePhotos.has(s.id)).length;

  return (
    <section className="page">
      <h1>立像</h1>
      <p className="progress">
        {ALL_STATUES.length}体中 <strong>{done}</strong>体 撮影済み
      </p>
      <GeoBanner geo={geo} />
      {sorted.map(({ item, distance }) => (
        <SpotCard key={item.id} spot={item} distance={distance} collection={collection} here={geo.position} />
      ))}
    </section>
  );
}
