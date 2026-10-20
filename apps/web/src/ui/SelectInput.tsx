// Adapted from shadcn/ui (Radix). See shadcn.LICENSE.
import type { ComponentProps } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from './cn';
import { inputFocus, inputSurface } from './Input';

type SelectInputProps = Omit<ComponentProps<typeof Select.Trigger>, 'value' | 'defaultValue' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  appearance?: 'default' | 'plain' | 'toolbar';
  placeholder?: string;
  side?: 'top' | 'bottom';
  name?: string;
  required?: boolean;
};

/** A shared single-choice field; commands belong in DropdownMenu. */
export function SelectInput({
  children, className, appearance = 'default', value, onValueChange,
  placeholder = 'Select…', side = 'bottom', disabled, name, required, ...props
}: SelectInputProps) {
  return <Select.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name} required={required}>
    <Select.Trigger {...props} data-slot="select-trigger" className={cn(
      'ui-input flex items-center justify-between gap-2 text-left cursor-pointer aria-invalid:border-danger [&>span:first-child]:truncate',
      inputFocus,
      appearance === 'default' ? inputSurface
        : 'w-auto min-w-0 min-h-8 compact:min-h-10 shrink-0 rounded-control border-0 px-2 py-1.5 text-ui',
      appearance === 'plain' && 'bg-transparent text-muted hover:bg-hover hover:text-ink',
      appearance === 'toolbar' && 'bg-transparent text-[var(--ui-toolbar-ink)] hover:bg-[var(--ui-toolbar-hover)]',
      className,
    )}>
      <Select.Value placeholder={placeholder} />
      <Select.Icon asChild><ChevronDown aria-hidden="true" className="size-3.5 shrink-0 opacity-70" /></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content data-slot="select-content" aria-label={props['aria-label']} position="popper" side={side} sideOffset={6} collisionPadding={8}
        className="z-[100] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-16px)] max-h-[min(320px,var(--radix-select-content-available-height))] overflow-hidden rounded-md border border-solid border-line bg-raised text-ink shadow-xl outline-none"
        onKeyDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}>
        <Select.ScrollUpButton className="flex h-6 items-center justify-center text-muted"><ChevronUp size={14} aria-hidden="true" /></Select.ScrollUpButton>
        <Select.Viewport className="p-1">{children}</Select.Viewport>
        <Select.ScrollDownButton className="flex h-6 items-center justify-center text-muted"><ChevronDown size={14} aria-hidden="true" /></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}

export function SelectOption({ children, className, ...props }: ComponentProps<typeof Select.Item>) {
  return <Select.Item {...props} data-slot="select-option" className={cn(
    'relative flex min-h-8 compact:min-h-11 items-center rounded-control py-1.5 pr-8 pl-2 text-ui leading-[1.4] select-none cursor-default outline-none data-[highlighted]:bg-selected data-[highlighted]:text-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
    className,
  )}>
    <Select.ItemText>{children}</Select.ItemText>
    <Select.ItemIndicator className="absolute right-2 flex size-3.5 items-center justify-center text-accent"><Check size={14} aria-hidden="true" /></Select.ItemIndicator>
  </Select.Item>;
}
