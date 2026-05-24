import { useEffect, useRef } from 'react';

export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let released = false;

    navigator.wakeLock.request('screen').then((lock) => {
      if (released) {
        void lock.release();
        return;
      }
      lockRef.current = lock;
    }).catch(() => {});

    return () => {
      released = true;
      if (lockRef.current) {
        void lockRef.current.release();
        lockRef.current = null;
      }
    };
  }, [active]);
}
