import { useId, type ComponentProps, type ReactNode } from 'react';
import { classes } from './classes';

type FieldProps = ComponentProps<'label'> & {
  variant?: 'stack' | 'number' | 'checkbox' | 'color' | 'range' | 'inline';
  label?: ReactNode;
  invalid?: boolean;
};

const variants = {
  stack: 'flex flex-col gap-[5px]',
  number: 'flex flex-col gap-[5px] [&_em]:not-italic [&_em]:text-caption [&_em]:text-danger',
  checkbox: 'flex flex-row items-center gap-2 min-h-[34px]',
  inline: 'flex flex-row items-center gap-2',
  color: 'flex flex-row items-center gap-2 min-h-control p-1.5 border border-solid border-line rounded-control bg-raised text-ink [&_code]:ml-auto [&_code]:text-muted [&_code]:text-caption',
  range: 'grid grid-cols-[1fr_auto] gap-2 text-ui mb-3.5 [&>span]:text-accent [&>span]:tabular-nums',
};

/** May wrap a native control or use htmlFor when the control is elsewhere. */
export function Field({ variant = 'stack', label, invalid, className, children, ...props }: FieldProps) {
  return <label {...props} className={classes(
    'ui-field min-w-0 leading-[1.4] [.ui-field+&]:mt-3 [&>.ui-field-message]:m-0 [&>.ui-field-message]:text-caption',
    variant !== 'color' && 'text-muted', variant !== 'range' && 'text-label',
    variants[variant], invalid && '[&_.ui-field-control]:border-danger', className,
  )}>
    {label != null && <span>{label}</span>}{children}
  </label>;
}

export function FieldControl({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={classes(
    'ui-field-control flex items-center min-h-control min-w-0 overflow-hidden border border-solid border-line rounded-control bg-raised focus-within:outline-2 focus-within:outline-solid focus-within:outline-accent focus-within:outline-offset-1 [&_.ui-input]:border-0 [&_.ui-input]:rounded-none [&_.ui-input]:bg-transparent [&_.ui-input]:min-h-[calc(var(--ui-control-height)-2px)] [&_.ui-input:focus-visible]:outline-none [&_small]:shrink-0 [&_small]:text-caption [&_small]:text-muted [&_small]:pr-1.5 [&_small]:pl-0.5',
    className,
  )} />;
}

export function FieldMessage({ tone = 'hint', className, ...props }: ComponentProps<'span'> & { tone?: 'hint' | 'error' }) {
  return <span {...props} className={classes(
    'ui-field-message block my-2.5 text-label leading-[1.6]',
    tone === 'error' ? 'text-danger' : 'text-muted', className,
  )} />;
}

/** Shared association for compound fields without replacing native validation. */
export function useFieldIds(id?: string) {
  const generated = useId();
  const control = id ?? generated;
  return { control, message: control + '-message' };
}
