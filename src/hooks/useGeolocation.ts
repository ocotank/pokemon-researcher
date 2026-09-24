import { useEffect, useState } from 'react';

export type Position = { lat: number; lng: number; accuracy: number };
export type GeoState = {
  status: 'unsupported' | 'locating' | 'ok' | 'denied' | 'error';
  position: Position | null;
  message?: string;
};

const supported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;
const toPosition = (p: GeolocationPosition): Position => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
});
const PERMISSION_DENIED = 1;

export function useGeolocation(enabled: boolean): GeoState {
  const [state, setState] = useState<GeoState>(() =>
    supported()
      ? { status: 'locating', position: null }
      : { status: 'unsupported', position: null, message: 'この端末では位置情報が使えません' },
  );

  useEffect(() => {
    if (!enabled || !supported()) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setState({ status: 'ok', position: toPosition(p) }),
      (e) =>
        setState((s) =>
          e.code === PERMISSION_DENIED
            ? {
                status: 'denied',
                position: null,
                message: '位置情報が許可されていません。設定アプリ →「プライバシーとセキュリティ」→「位置情報サービス」→「Safari」から許可してください',
              }
            : {
                status: 'error',
                position: s.position,
                message: '現在地を取得できませんでした（地下や屋内では取れないことがあります）',
              },
        ),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}

export function getPositionOnce(timeoutMs = 10_000): Promise<Position | null> {
  if (!supported()) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toPosition(p)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    ),
  );
}
