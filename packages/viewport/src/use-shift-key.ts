import { useEffect, useState } from 'react';

/** Modifier changes refresh stationary previews too; focus loss never leaves a constraint stuck. */
export function useShiftKey() {
  const [shift, setShift] = useState(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setShift(event.type === 'keydown');
    };
    const blur = () => setShift(false);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); window.removeEventListener('blur', blur); };
  }, []);
  return { shift, setShift };
}
