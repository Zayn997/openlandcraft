import type { ComponentProps } from 'react';
import { classes } from './classes';

/** Form ownership and editor commands stay in the caller. */
export function ActionBar({ pending, className, ...props }: ComponentProps<'div'> & { pending: boolean }) {
  return <div {...props} className={classes(
    'border-0 border-t border-solid border-line [&>div]:flex [&>div]:items-center [&>div]:gap-1.5 [&>div]:m-0 [&>div]:text-label [&_.primary-button]:w-full [&_.cancel-button]:w-auto [&_.cancel-button]:p-[7px] [&_.cancel-button]:text-label [&_.cancel-button_span]:hidden [&_.region-preview]:col-span-full [&_.region-preview]:m-0 [&_.region-preview]:min-h-[34px] [&_.region-preview]:text-label',
    pending
      ? 'sticky bottom-0 z-2 bg-surface pt-3 pb-2 shadow-[0_-6px_12px_var(--surface)] grid grid-cols-[1fr_auto] gap-x-2 gap-y-2.5 [&>div]:col-span-full [&>div]:text-accent'
      : 'py-3 [&>div]:text-muted [&>button:disabled]:hidden [&_.region-preview]:mt-2.5',
    className,
  )} data-pending={pending} />;
}
