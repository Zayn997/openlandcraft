import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorEscape } from './use-editor-escape';

const lifecycle = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock('react', () => ({ useEffect: (effect: () => (() => void) | undefined) => {
  const cleanup = effect();
  if (cleanup) lifecycle.cleanups.push(cleanup);
} }));
afterEach(() => { lifecycle.cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

function setup(enabled = true) {
  const target = new EventTarget(), cancel = vi.fn();
  vi.stubGlobal('window', target);
  const listen = vi.spyOn(target, 'addEventListener');
  useEditorEscape(cancel, enabled);
  return { target, cancel, listen };
}
function key(key = 'Escape', extras = {}) {
  return Object.assign(new Event('keydown', { cancelable: true }), { key, isComposing: false, repeat: false, ...extras });
}

describe('Editor-wide Escape', () => {
  it('cancels in capture phase without preventing the focused control from closing', () => {
    const { target, cancel, listen } = setup();
    expect(listen).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
    const closeControl = vi.fn();
    target.addEventListener('keydown', closeControl);
    const event = key(); target.dispatchEvent(event);
    expect(cancel).toHaveBeenCalledOnce();
    expect(closeControl).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
  it('still cancels when another handler has prevented the default Escape action', () => {
    const { target, cancel } = setup();
    const event = key(); event.preventDefault(); target.dispatchEvent(event);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('ignores unrelated keys, IME composition, and held-key repeats', () => {
    const { target, cancel } = setup();
    target.dispatchEvent(key('Enter'));
    target.dispatchEvent(key('Escape', { isComposing: true }));
    target.dispatchEvent(key('Escape', { repeat: true }));
    expect(cancel).not.toHaveBeenCalled();
  });
  it('does not intercept keys while loading or after unmount', () => {
    const { target, cancel } = setup(false);
    target.dispatchEvent(key()); expect(cancel).not.toHaveBeenCalled();
    useEditorEscape(cancel, true);
    lifecycle.cleanups.splice(0).forEach(cleanup => cleanup());
    target.dispatchEvent(key()); expect(cancel).not.toHaveBeenCalled();
  });
});
