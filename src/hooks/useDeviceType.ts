'use client';

import { useState, useEffect } from 'react';

type DeviceType = 'desktop' | 'mobile';

export function useDeviceType(breakpoint: number = 768): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');

  useEffect(() => {
    const checkDevice = () => {
      setDeviceType(window.innerWidth < breakpoint ? 'mobile' : 'desktop');
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, [breakpoint]);

  return deviceType;
}
