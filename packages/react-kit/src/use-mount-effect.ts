import { useEffect, type EffectCallback } from 'react';

export const useMountEffect = (fn: EffectCallback): void => {
  useEffect(fn, []);
};
