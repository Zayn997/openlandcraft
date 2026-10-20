import type { ComponentProps } from 'react';
import { classes } from './classes';

export type InputProps = ComponentProps<'input'> & {
  appearance?: 'default' | 'plain';
};

export const inputFocus = 'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-default motion-reduce:transition-none';
export const inputSurface = 'w-full min-w-0 min-h-control px-2 py-1.5 border border-solid border-line rounded-control bg-raised text-ink text-control';
export const inputPlain = 'min-w-0 w-full min-h-[30px] p-0 border-0 bg-transparent text-ink text-ui';

const choiceStyles = {
  checkbox: 'size-[15px] m-0 shrink-0 accent-accent',
  color: 'appearance-none size-[22px] shrink-0 p-0 border-0 bg-transparent cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-solid [&::-webkit-color-swatch]:border-line [&::-webkit-color-swatch]:rounded-[3px]',
  range: 'col-span-full w-full h-5 m-0 accent-accent cursor-pointer',
  file: '',
};

/** Native props (including ref, validation and form events) pass through unchanged. */
export function Input({ className, appearance = 'default', type = 'text', ...props }: InputProps) {
  const choice = type in choiceStyles ? choiceStyles[type as keyof typeof choiceStyles] : null;
  return <input {...props} type={type} className={classes(
    'ui-input', inputFocus, 'aria-invalid:border-danger',
    choice ?? (appearance === 'plain' ? inputPlain : inputSurface),
    type === 'number' && 'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
    className,
  )} />;
}
