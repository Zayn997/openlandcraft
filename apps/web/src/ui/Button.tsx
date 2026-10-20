// Adapted from shadcn/ui (Radix). See shadcn.LICENSE.
import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border border-solid border-transparent text-ui font-medium leading-[1.4] whitespace-nowrap cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-ink hover:bg-accent/90',
        secondary: 'bg-raised text-ink hover:bg-input',
        outline: 'border-line bg-transparent text-ink hover:bg-raised',
        ghost: 'bg-transparent text-muted hover:bg-hover hover:text-ink',
        toolbar: 'bg-transparent text-[var(--ui-toolbar-ink)] hover:bg-[var(--ui-toolbar-hover)] aria-pressed:bg-[var(--ui-toolbar-hover)] aria-pressed:font-semibold',
        destructive: 'border-line bg-transparent text-danger hover:bg-danger/10',
        link: 'bg-transparent text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-control px-3 py-1.5',
        sm: 'min-h-8 px-2 py-1 text-label',
        icon: 'size-8 p-0 compact:size-10',
        'icon-sm': 'size-7 p-0 compact:size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant = 'default', size = 'default', asChild = false, type = 'button', ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component {...props} {...(!asChild && { type })} data-slot="button" data-variant={variant} data-size={size}
    className={cn(buttonVariants({ variant, size }), className)} />;
}
