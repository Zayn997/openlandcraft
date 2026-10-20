// Adapted from shadcn/ui. See shadcn.LICENSE.
import type { ComponentProps } from 'react';
import { cn } from './cn';

export function Card({ className, size = 'default', ...props }: ComponentProps<'div'> & { size?: 'default' | 'compact' }) {
  return <div {...props} data-slot="card" data-size={size} className={cn(
    'flex flex-col min-w-0 rounded-md border border-solid border-line bg-raised text-ink',
    size === 'compact' ? '[--card-padding:10px] gap-2 py-2.5' : '[--card-padding:16px] gap-3 py-4',
    className,
  )} />;
}
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} data-slot="card-header" className={cn(
    'grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 px-[var(--card-padding)]', className,
  )} />;
}
export function CardTitle({ className, ...props }: ComponentProps<'h4'>) {
  return <h4 {...props} data-slot="card-title" className={cn('m-0 min-w-0 text-ui font-medium leading-[1.4]', className)} />;
}
export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p {...props} data-slot="card-description" className={cn('m-0 col-start-1 text-label leading-[1.6] text-muted', className)} />;
}
export function CardAction({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} data-slot="card-action" className={cn('col-start-2 row-start-1 row-span-2 flex items-center gap-1', className)} />;
}
export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} data-slot="card-content" className={cn('min-w-0 px-[var(--card-padding)]', className)} />;
}
export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} data-slot="card-footer" className={cn('flex items-center gap-2 px-[var(--card-padding)]', className)} />;
}
