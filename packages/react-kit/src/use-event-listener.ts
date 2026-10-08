import { useEffect, useEffectEvent, type RefObject } from 'react';

type ListenerOptions = boolean | AddEventListenerOptions;

export function useEventListener<Type extends keyof WindowEventMap>(
  target: Window,
  type: Type,
  handler: (event: WindowEventMap[Type]) => void,
  options?: ListenerOptions,
): void;
export function useEventListener<Type extends keyof DocumentEventMap>(
  target: Document,
  type: Type,
  handler: (event: DocumentEventMap[Type]) => void,
  options?: ListenerOptions,
): void;
export function useEventListener<Type extends keyof HTMLElementEventMap>(
  target: RefObject<HTMLElement | null>,
  type: Type,
  handler: (event: HTMLElementEventMap[Type]) => void,
  options?: ListenerOptions,
): void;
export function useEventListener(
  target: Window | Document | RefObject<HTMLElement | null>,
  type: string,
  handler: (event: Event) => void,
  options?: ListenerOptions,
): void {
  const onEvent = useEffectEvent(handler);
  const {
    capture = false,
    once = false,
    passive,
    signal,
  } = typeof options === 'boolean' ? { capture: options } : (options ?? {});

  useEffect(() => {
    const element = 'current' in target ? target.current : target;
    if (element === null) return;
    const listener = (event: Event) => onEvent(event);
    const listenerOptions: AddEventListenerOptions = { capture, once };
    if (passive !== undefined) listenerOptions.passive = passive;
    if (signal !== undefined) listenerOptions.signal = signal;
    element.addEventListener(type, listener, listenerOptions);
    return () => element.removeEventListener(type, listener, { capture });
  }, [target, type, capture, once, passive, signal]);
}
