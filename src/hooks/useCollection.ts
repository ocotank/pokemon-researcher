import { useCallback, useEffect, useState } from 'react';
import {
  getAllPanels,
  getAllSpotOverrides,
  getAllSpotPhotos,
  getAllStatueNames,
  getAllStatuePhotos,
  type Panel,
  type SpotOverride,
  type SpotPhoto,
  type StatuePhoto,
} from '../lib/db';

export type Collection = {
  statuePhotos: Map<string, StatuePhoto>;
  spotPhotos: Map<string, SpotPhoto>;
  panels: Panel[];
  statueNames: Map<string, string>;
  spotOverrides: Map<string, SpotOverride>;
  loaded: boolean;
  reload: () => Promise<void>;
};

type Data = Omit<Collection, 'reload'>;

export function useCollection(): Collection {
  const [data, setData] = useState<Data>({
    statuePhotos: new Map(),
    spotPhotos: new Map(),
    panels: [],
    statueNames: new Map(),
    spotOverrides: new Map(),
    loaded: false,
  });

  const reload = useCallback(async () => {
    const [photos, spotShots, panels, names, overrides] = await Promise.all([
      getAllStatuePhotos(),
      getAllSpotPhotos(),
      getAllPanels(),
      getAllStatueNames(),
      getAllSpotOverrides(),
    ]);
    setData({
      statuePhotos: new Map(photos.map((p) => [p.statueId, p])),
      spotPhotos: new Map(spotShots.map((p) => [p.spotId, p])),
      panels,
      statueNames: new Map(names.map((n) => [n.statueId, n.name])),
      spotOverrides: new Map(overrides.map((o) => [o.spotId, o])),
      loaded: true,
    });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...data, reload };
}
