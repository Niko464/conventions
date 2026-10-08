import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { useEventListener } from '../src/index.ts';

const WindowKeys = ({ onKey }: { onKey: (key: string) => void }) => {
  useEventListener(window, 'keydown', (event) => onKey(event.key));
  return null;
};

const DocumentClicks = ({ onClick }: { onClick: (button: number) => void }) => {
  useEventListener(document, 'click', (event) => onClick(event.button));
  return null;
};

const ButtonClicks = ({ onClick }: { onClick: (detail: number) => void }) => {
  const ref = useRef<HTMLButtonElement>(null);
  useEventListener(ref, 'click', (event) => onClick(event.detail));
  return <button ref={ref}>press</button>;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEventListener on window', () => {
  it('fires with the typed event, and stops after unmount', () => {
    const onKey = vi.fn();
    const { unmount } = render(<WindowKeys onKey={onKey} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onKey).toHaveBeenCalledWith('Escape');
    unmount();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onKey).toHaveBeenCalledOnce();
  });

  it('calls the newest handler after a re-render, without re-subscribing', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<WindowKeys onKey={first} />);
    rerender(<WindowKeys onKey={second} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('Escape');
    expect(add.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
    expect(remove.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(0);
  });
});

describe('useEventListener on document', () => {
  it('listens on window and document even when an element is named current', () => {
    const onKey = vi.fn();
    const onClick = vi.fn();
    const named = document.createElement('form');
    named.id = 'current';
    named.setAttribute('name', 'current');
    document.body.append(named);
    render(
      <>
        <WindowKeys onKey={onKey} />
        <DocumentClicks onClick={onClick} />
      </>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document, { button: 1 });
    named.remove();
    expect(onKey).toHaveBeenCalledWith('Escape');
    expect(onClick).toHaveBeenCalledWith(1);
  });

  it('fires, and stops after unmount', () => {
    const onClick = vi.fn();
    const { unmount } = render(<DocumentClicks onClick={onClick} />);
    fireEvent.click(document, { button: 1 });
    expect(onClick).toHaveBeenCalledWith(1);
    unmount();
    fireEvent.click(document);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('useEventListener on an element ref', () => {
  it('fires, and stops after unmount', () => {
    const onClick = vi.fn();
    const { getByRole, unmount } = render(<ButtonClicks onClick={onClick} />);
    const button = getByRole('button');
    fireEvent.click(button, { detail: 2 });
    expect(onClick).toHaveBeenCalledWith(2);
    unmount();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls the newest handler after a re-render, without re-subscribing', () => {
    const add = vi.spyOn(HTMLButtonElement.prototype, 'addEventListener');
    const remove = vi.spyOn(HTMLButtonElement.prototype, 'removeEventListener');
    const first = vi.fn();
    const second = vi.fn();
    const { getByRole, rerender } = render(<ButtonClicks onClick={first} />);
    rerender(<ButtonClicks onClick={second} />);
    fireEvent.click(getByRole('button'), { detail: 3 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(3);
    expect(add.mock.calls.filter(([type]) => type === 'click')).toHaveLength(1);
    expect(remove.mock.calls.filter(([type]) => type === 'click')).toHaveLength(0);
  });
});

describe('useEventListener types', () => {
  it('types the event from the target and the event type', () => {
    const Typed = () => {
      const ref = useRef<HTMLInputElement>(null);
      useEventListener(window, 'keydown', (event) => {
        expectTypeOf(event).toEqualTypeOf<KeyboardEvent>();
      });
      useEventListener(document, 'visibilitychange', (event) => {
        expectTypeOf(event).toEqualTypeOf<Event>();
      });
      useEventListener(ref, 'input', (event) => {
        expectTypeOf(event).toEqualTypeOf<InputEvent>();
      });
      // @ts-expect-error: not an event a window dispatches
      useEventListener(window, 'not-an-event', () => {});
      return <input ref={ref} />;
    };
    expect(render(<Typed />).container.querySelector('input')).not.toBeNull();
  });
});
