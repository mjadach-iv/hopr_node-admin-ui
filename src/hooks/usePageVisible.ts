import { type DependencyList, useEffect, useRef, useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

/**
 * Whether the app is on screen. False while its browser tab is in the background and, in the
 * desktop app, while the window is minimised or hidden, on macOS also while another window covers it.
 */
export const usePageVisible = () => useSyncExternalStore(subscribe, () => document.visibilityState === 'visible');

const ignore = () => undefined;

/**
 * Calls `callback` while the app is on screen, `delay` ms after the promise it returned settled, so
 * a slow response pushes the next call back instead of stacking calls up. A change in `deps` calls it
 * right away. Off screen it pauses; back on screen it calls once `delay` has passed since the last
 * call settled, so looking away for a moment does not refetch.
 */
export const useVisibleInterval = (callback: () => Promise<unknown> | void, delay: number, deps: DependencyList) => {
  const visible = usePageVisible();
  const settledAt = useRef(0);
  const running = useRef<Promise<void> | null>(null);
  const lastDeps = useRef(deps);

  useEffect(() => {
    // compared rather than reset on every run, which StrictMode's second run would do with a call running
    if (deps.some((dep, i) => !Object.is(dep, lastDeps.current[i]))) {
      // new inputs are fetched without waiting, a call still running with the old ones no longer holds them up
      lastDeps.current = deps;
      settledAt.current = 0;
      running.current = null;
    }
    if (!visible) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (cancelled) return;
      if (running.current) {
        running.current.then(schedule);
        return;
      }
      const wait = settledAt.current + delay - Date.now();
      if (wait > 0) timeout = setTimeout(call, wait);
      else call();
    };
    const call = () => {
      const current: Promise<void> = Promise.resolve(callback())
        .then(ignore, ignore)
        .then(() => {
          if (running.current !== current) return;
          running.current = null;
          settledAt.current = Date.now();
        });
      running.current = current;
      schedule();
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [visible, delay, ...deps]);
};
