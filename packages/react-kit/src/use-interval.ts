import { useEffect, useEffectEvent } from 'react';

export type IntervalOptions = {
  delay?: number;
  enabled?: boolean;
};

export const useInterval = (
  fn: () => void,
  ms: number,
  { delay = ms, enabled = true }: IntervalOptions = {},
): void => {
  const tick = useEffectEvent(fn);

  useEffect(() => {
    if (!enabled) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(() => tick(), ms);
    }, delay);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [ms, delay, enabled]);
};
