import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMountEffect } from '../src/index.ts';

const Probe = ({ onMount }: { label: string; onMount: () => void | (() => void) }) => {
  useMountEffect(onMount);
  return null;
};

describe('useMountEffect', () => {
  it('runs once across re-renders', () => {
    const onMount = vi.fn();
    const { rerender } = render(<Probe label="first" onMount={onMount} />);
    rerender(<Probe label="second" onMount={onMount} />);
    rerender(<Probe label="third" onMount={vi.fn()} />);
    expect(onMount).toHaveBeenCalledOnce();
  });

  it('runs its cleanup on unmount, and not before', () => {
    const cleanup = vi.fn();
    const { rerender, unmount } = render(<Probe label="first" onMount={() => cleanup} />);
    rerender(<Probe label="second" onMount={() => cleanup} />);
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
