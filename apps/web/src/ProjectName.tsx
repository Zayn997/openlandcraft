import { useRef, useState } from 'react';
import { Button } from './ui';
import { InlineRename } from './InlineRename';

/** One project title, with pointer and keyboard access to the same rename action. */
export function ProjectName({ name, disabled, onRename }: { name: string; disabled?: boolean; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <div className="min-w-0 flex-1 max-w-[320px]">
    {editing ? <InlineRename name={name} label="Project name" maxLength={100}
      className="w-full min-w-0" returnFocus={trigger} onSave={onRename} onClose={() => setEditing(false)} />
      : <Button ref={trigger} variant="ghost" disabled={disabled} aria-label="Rename project"
        title={disabled ? 'Finish or cancel the current edit before renaming' : `${name} · Double-click to rename · Enter or F2`}
        className="w-full min-w-0 justify-start px-1 text-ink"
        onDoubleClick={() => setEditing(true)}
        onClick={event => { if (event.detail === 0) setEditing(true); }}
        onKeyDown={event => { if (event.key === 'F2') { event.preventDefault(); event.stopPropagation(); setEditing(true); } }}>
        <span className="truncate">{name}</span>
      </Button>}
  </div>;
}
