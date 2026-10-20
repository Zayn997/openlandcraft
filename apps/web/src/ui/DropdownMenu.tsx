// Adapted from shadcn/ui (Radix). See shadcn.LICENSE.
import type { ComponentProps } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuSub = Menu.Sub;

const surface = 'z-50 min-w-[200px] max-w-[calc(100vw-16px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto overflow-x-hidden rounded-md border border-solid border-line bg-raised p-1 text-ink shadow-xl outline-none';
const item = 'relative flex min-h-8 compact:min-h-10 items-center gap-2 rounded-control px-2 py-1.5 text-ui leading-[1.4] select-none cursor-default outline-none data-[highlighted]:bg-selected data-[highlighted]:text-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0';

export function DropdownMenuContent({ className, sideOffset = 6, collisionPadding = 8, ...props }: ComponentProps<typeof Menu.Content>) {
  return <Menu.Portal><Menu.Content {...props} data-slot="dropdown-menu-content" sideOffset={sideOffset} collisionPadding={collisionPadding} className={cn(surface, className)} /></Menu.Portal>;
}
export function DropdownMenuItem({ className, variant = 'default', ...props }: ComponentProps<typeof Menu.Item> & { variant?: 'default' | 'destructive' }) {
  return <Menu.Item {...props} data-slot="dropdown-menu-item" className={cn(
    item, variant === 'destructive' && 'text-danger data-[highlighted]:bg-danger/10 data-[highlighted]:text-danger', className,
  )} />;
}
export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label {...props} className={cn('px-2 pt-2 pb-1 text-caption text-muted font-medium tracking-wide', className)} />;
}
export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator {...props} className={cn('h-px my-1 bg-line', className)} />;
}
export function DropdownMenuSubTrigger({ className, children, ...props }: ComponentProps<typeof Menu.SubTrigger>) {
  return <Menu.SubTrigger {...props} className={cn(item, 'data-[state=open]:bg-selected', className)}>
    {children}<ChevronRight aria-hidden="true" className="ml-auto" />
  </Menu.SubTrigger>;
}
export function DropdownMenuSubContent({ className, ...props }: ComponentProps<typeof Menu.SubContent>) {
  return <Menu.Portal><Menu.SubContent {...props} data-slot="dropdown-menu-content" collisionPadding={8} className={cn(surface, className)} /></Menu.Portal>;
}
