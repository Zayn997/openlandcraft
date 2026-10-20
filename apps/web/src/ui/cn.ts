import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach the merger our theme so text size never replaces a semantic text color.
const merge = extendTailwindMerge({
  extend: { theme: {
    text: ['caption', 'label', 'ui', 'title', 'control'],
    spacing: ['control', 'panel'],
    radius: ['control'],
  } },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
