import type { ComponentProps } from 'react';
import { classes } from './classes';

const justification = { start: 'justify-start', between: 'justify-between', end: 'justify-end' };
const gaps = { none: 'gap-0', xs: 'gap-1.5', sm: 'gap-2', md: 'gap-3' };
export function Row({ className, justify = 'start', gap = 'sm', wrap, ...props }: ComponentProps<'div'> & {
  justify?: 'start' | 'between' | 'end'; gap?: 'none' | 'xs' | 'sm' | 'md'; wrap?: boolean;
}) {
  return <div {...props} className={classes(
    'flex items-center min-w-0 [&>.ui-field+.ui-field]:mt-0',
    justification[justify], gaps[gap], wrap && 'flex-wrap', className,
  )} />;
}

const gridColumns = { 2: 'grid-cols-2', 3: 'grid-cols-3', auto: 'grid-cols-2 has-[>:nth-child(3)]:grid-cols-3' };
export function FieldGrid({ columns = 2, className, ...props }: ComponentProps<'div'> & { columns?: 2 | 3 | 'auto' }) {
  return <div {...props} className={classes(
    'ui-field-grid grid gap-x-2 gap-y-3 min-w-0 my-2.5 [&>.ui-field+.ui-field]:mt-0',
    gridColumns[columns], className,
  )} />;
}
export function PropertyRow({ className, ...props }: ComponentProps<'div'>) {
  return <Row {...props} justify="between" className={classes(
    'mt-2.5 text-muted text-label [&>:last-child]:flex [&>:last-child]:items-center [&>:last-child]:gap-[5px] [&>:last-child]:text-ink',
    className,
  )} />;
}
export function ActionRow({ className, ...props }: ComponentProps<'div'>) {
  return <Row {...props} wrap className={classes(
    'pt-3 border-0 border-t border-solid border-line [&>button]:flex-1',
    className,
  )} />;
}
