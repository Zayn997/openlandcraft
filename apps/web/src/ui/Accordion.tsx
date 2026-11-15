// Adapted from shadcn/ui (Radix). See shadcn.LICENSE.
import type { ComponentProps } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item {...props} data-slot="accordion-item"
    className={cn('border-0 border-b border-solid border-line last:border-b-0', className)} />;
}

export function AccordionTrigger({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return <AccordionPrimitive.Header className="m-0 flex">
    <AccordionPrimitive.Trigger {...props} data-slot="accordion-trigger"
      className={cn('group flex flex-1 items-center justify-between gap-2 min-h-8 compact:min-h-10 rounded-control bg-transparent px-2 py-1.5 text-left text-ui font-medium text-ink cursor-pointer outline-none hover:bg-selected hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px] disabled:pointer-events-none disabled:opacity-40', className)}>
      {children}
      <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>;
}

export function AccordionContent({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Content>) {
  return <AccordionPrimitive.Content {...props} data-slot="accordion-content"
    className="overflow-hidden text-ui data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
    <div className={cn('pb-2', className)}>{children}</div>
  </AccordionPrimitive.Content>;
}
