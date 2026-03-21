'use client';

import { useSyncExternalStore } from 'react';

const BREAKPOINTS = [
  { maxWidth: 479, ticks: 10 },
  { maxWidth: 639, ticks: 20 },
  { maxWidth: 767, ticks: 30 },
  { maxWidth: 1023, ticks: 40 },
  { maxWidth: 1279, ticks: 50 },
  { maxWidth: Infinity, ticks: 70 },
];

function getMaxTicks(): number {
  if (typeof window === 'undefined') return 70;
  const w = window.innerWidth;
  const bp = BREAKPOINTS.find((b) => w <= b.maxWidth);
  return bp?.ticks ?? 70;
}

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

export function useChartMaxTicks(): number {
  return useSyncExternalStore(subscribe, getMaxTicks, () => 70);
}
