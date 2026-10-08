import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMountEffect } from '../src/index.ts';

const Probe = ({ onMount }: { onMount: () => void | (() => void) }) => {
  useMountEffect(onMount);
  return null;
};

describe('useMountEffect', () => {
  it('runs once across re-renders', () => {
    const onMount = vi.fn();
    const { rerender } = render(<Probe onMount={onMount} />);
    rerender(<Probe onMount={onMount} />);
    rerender(<Probe onMount={vi.fn()} />);
    expect(onMount).toHaveBeenCalledOnce();
  });

  it('runs its cleanup on unmount, and not before', () => {
    const cleanup = vi.fn();
    const { rerender, unmount } = render(<Probe onMount={() => cleanup} />);
    rerender(<Probe onMount={() => cleanup} />);
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
