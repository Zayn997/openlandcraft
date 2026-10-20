import type { ComponentProps, CSSProperties } from 'react';
import { Row } from './Row';
import { classes } from './classes';

/** Shared tree-row layout; the caller supplies tree semantics and interaction. */
export function TreeRow({ depth = 0, selected = false, muted = false, className, style, ...props }:
  ComponentProps<'div'> & { depth?: number; selected?: boolean; muted?: boolean }) {
  return <Row {...props} gap="xs" className={classes(
    'min-h-[34px] py-0 pr-1 pl-[calc(6px+var(--tree-depth,0)*14px)] rounded-control text-ui cursor-default',
    selected ? 'bg-selected text-accent hover:bg-selected-hover' : 'hover:bg-hover',
    muted && 'opacity-60', className,
  )}
    style={{ '--tree-depth': depth, ...style } as CSSProperties} />;
}
