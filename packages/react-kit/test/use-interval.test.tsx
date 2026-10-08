import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInterval } from '../src/index.ts';

type TickerProps = {
  onTick: () => void;
  ms: number;
  delay?: number;
  enabled?: boolean;
};

const Ticker = ({ onTick, ms, ...options }: TickerProps) => {
  useInterval(onTick, ms, options);
  return null;
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useInterval', () => {
  it('ticks every ms', () => {
    const onTick = vi.fn();
    render(<Ticker onTick={onTick} ms={100} />);
    advance(99);
    expect(onTick).not.toHaveBeenCalled();
    advance(1);
    expect(onTick).toHaveBeenCalledTimes(1);
    advance(300);
    expect(onTick).toHaveBeenCalledTimes(4);
  });

  it('waits for delay before the first tick, then ticks every ms', () => {
    const onTick = vi.fn();
    render(<Ticker onTick={onTick} ms={100} delay={500} />);
    advance(499);
    expect(onTick).not.toHaveBeenCalled();
    advance(1);
    expect(onTick).toHaveBeenCalledTimes(1);
    advance(99);
    expect(onTick).toHaveBeenCalledTimes(1);
    advance(1);
    expect(onTick).toHaveBeenCalledTimes(2);
    advance(200);
    expect(onTick).toHaveBeenCalledTimes(4);
  });

  it('stops when enabled turns false, and starts over when it turns true again', () => {
    const onTick = vi.fn();
    const { rerender } = render(<Ticker onTick={onTick} ms={100} enabled />);
    advance(250);
    expect(onTick).toHaveBeenCalledTimes(2);
    rerender(<Ticker onTick={onTick} ms={100} enabled={false} />);
    advance(1000);
    expect(onTick).toHaveBeenCalledTimes(2);
    rerender(<Ticker onTick={onTick} ms={100} enabled />);
    advance(99);
    expect(onTick).toHaveBeenCalledTimes(2);
    advance(1);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('does not tick while disabled from the start', () => {
    const onTick = vi.fn();
    render(<Ticker onTick={onTick} ms={100} enabled={false} />);
    advance(1000);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('restarts when ms changes', () => {
    const onTick = vi.fn();
    const { rerender } = render(<Ticker onTick={onTick} ms={100} />);
    advance(50);
    rerender(<Ticker onTick={onTick} ms={300} />);
    advance(299);
    expect(onTick).not.toHaveBeenCalled();
    advance(1);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('restarts when delay changes', () => {
    const onTick = vi.fn();
    const { rerender } = render(<Ticker onTick={onTick} ms={100} delay={500} />);
    advance(400);
    rerender(<Ticker onTick={onTick} ms={100} delay={200} />);
    advance(199);
    expect(onTick).not.toHaveBeenCalled();
    advance(1);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('calls the newest fn without restarting', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Ticker onTick={first} ms={100} />);
    advance(50);
    rerender(<Ticker onTick={second} ms={100} />);
    advance(50);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops after unmount', () => {
    const onTick = vi.fn();
    const { unmount } = render(<Ticker onTick={onTick} ms={100} />);
    advance(100);
    unmount();
    advance(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
