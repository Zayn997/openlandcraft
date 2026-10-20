import type { ComponentProps, ReactNode } from 'react';
import { classes } from './classes';

type PanelProps = ComponentProps<'section'> & { as?: 'section' | 'aside'; padding?: 'none' | 'body' };
export function Panel({ as: Tag = 'section', padding = 'none', className, ...props }: PanelProps) {
  return <Tag {...props} className={classes('min-w-0 min-h-0', padding === 'body' && 'py-4 px-panel', className)} />;
}
export function PanelHeader({ className, ...props }: ComponentProps<'header'>) {
  return <header {...props} className={classes(
    'flex items-center justify-between shrink-0 gap-2 h-12 pl-panel pr-2.5 border-0 border-b border-solid border-line text-ink text-ui [&_strong]:font-[550]',
    className,
  )} />;
}
const bodyClasses = 'min-w-0 px-panel pb-4';
export function PanelBody({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={classes(bodyClasses, className)} />;
}
export function PanelForm({ className, ...props }: ComponentProps<'form'>) {
  return <form {...props} className={classes(bodyClasses, className)} />;
}
export function PanelHeading({ icon, title, subtitle }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode }) {
  return <div className="flex items-center gap-2.5 py-[18px] short-screen:py-3">
    {icon && <div className="shrink-0 grid place-items-center size-8 border border-solid border-line rounded-md text-muted bg-raised [&_svg]:size-[18px]">{icon}</div>}
    <div className="min-w-0">
      <h2 className="font-heading font-semibold text-title leading-[1.4] mt-0 mx-0 mb-[3px] [overflow-wrap:anywhere]">{title}</h2>
      {subtitle != null && <span className="text-label text-muted leading-[1.6]">{subtitle}</span>}
    </div>
  </div>;
}
