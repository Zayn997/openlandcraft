import { useEffect } from 'react';

export function useEditorEscape(cancel: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || event.repeat) return;
      cancel();
      // Let the focused control also close its menu or discard its text draft.
    };
    // Handle Escape before menus, inputs, and the navigator consume it.
    const options = { capture: true };
    window.addEventListener('keydown', escape, options);
    return () => window.removeEventListener('keydown', escape, options);
  }, [cancel, enabled]);
}
