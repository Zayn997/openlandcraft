import { Panel } from './ui';
import { useId, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useInspectorSection } from './InspectorSectionsContext';

/** Can stand alone or share disclosure state through InspectorSectionsProvider. */
export function InspectorSection({ sectionId, title, children, defaultOpen = true, className = '' }: {
  sectionId: string; title: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string;
}) {
  const { open, setOpen } = useInspectorSection(sectionId, defaultOpen);
  const id = useId();
  return <Panel className={`inspector-section block border-0 border-t border-b-0 border-solid border-line p-0 m-0 ${className}`} data-expanded={open}>
    <h3 className="m-0"><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
      className="group flex items-center gap-1.5 w-full min-h-10 compact:min-h-11 px-0 py-2 bg-transparent text-ink text-left text-ui font-[550] rounded-[3px] hover:text-accent">
      <ChevronRight size={14} aria-hidden="true" className="text-muted shrink-0 transition-transform duration-150 group-aria-expanded:rotate-90 motion-reduce:transition-none" />
      <span className="flex justify-between items-center flex-1 gap-1.5 min-w-0 [&>span]:text-muted [&>span]:text-caption [&>span]:font-normal [&>span]:tracking-normal">{title}</span>
    </button></h3>
    <div id={id} className="min-w-0 pb-3.5 hidden:hidden [&>:first-child]:mt-0 [&>:last-child]:mb-0" hidden={!open} onInvalidCapture={event => {
      if (!open) {
        event.preventDefault();
        const field = event.target as HTMLElement;
        setOpen(true);
        requestAnimationFrame(() => field.focus());
      }
    }}>{children}</div>
  </Panel>;
}
