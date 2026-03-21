'use client';

import { useSyncExternalStore } from 'react';

const SM_MAX_PX = 639;

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(`(max-width: ${SM_MAX_PX}px)`);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(`(max-width: ${SM_MAX_PX}px)`).matches;
}

function getServerSnapshot() {
  return false;
}

export function useNarrowViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
