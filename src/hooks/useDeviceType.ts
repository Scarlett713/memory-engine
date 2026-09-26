'use client';

import { useCallback, useSyncExternalStore } from 'react';

type DeviceType = 'desktop' | 'mobile';

function subscribeToResize(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange);
  return () => window.removeEventListener('resize', onStoreChange);
}

const getServerSnapshot = () => 'desktop' as const;

export function useDeviceType(breakpoint: number = 768): DeviceType {
  const getSnapshot = useCallback(
    () => (window.innerWidth < breakpoint ? 'mobile' : 'desktop'),
    [breakpoint],
  );

  return useSyncExternalStore(subscribeToResize, getSnapshot, getServerSnapshot);
}
