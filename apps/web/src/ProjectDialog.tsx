import { Button, Field, FieldGrid, FieldMessage, NumberField, Panel, SelectInput, SelectOption, TextInput } from './ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createSite, type Project } from '@openlandcraft/core';

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="dialog-backdrop" onClick={onClose}><Panel ref={ref} className="help-dialog project-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
    // A portalled picker owns Escape and navigation until it closes.
    if ((event.target as HTMLElement).closest('[role="listbox"], [role="menu"], [role="combobox"][aria-expanded="true"]')) return;
    if ((event.ctrlKey || event.metaKey) && ['z', 'y', 's'].includes(event.key.toLowerCase())) { event.stopPropagation(); if (event.key.toLowerCase() === 's') event.preventDefault(); }
    if (event.key === 'Escape') { event.stopPropagation(); close.current(); }
    if (event.key === 'Tab') {
      const controls = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')].filter(control => control.tabIndex >= 0 && control.getClientRects().length > 0);
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0]?.focus(); }
    }
  }}><Button variant="ghost" size="icon" className="dialog-close icon-button" type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={18} /></Button><h2>{title}</h2>{children}</Panel></div>;
}

export function ProjectDialog({ mode, project, onClose, onCreate, onRename }: {
  mode: 'new' | 'rename'; project: Project; onClose: () => void; onCreate: (project: Project) => void; onRename: (name: string) => void;
}) {
  const [name, setName] = useState(mode === 'new' ? 'Untitled site' : project.name), [width, setWidth] = useState(90), [depth, setDepth] = useState(72);
  const [resolution, setResolution] = useState<129 | 257>(129), [preset, setPreset] = useState<'coast' | 'flat'>('coast'), [error, setError] = useState('');
  return <Dialog title={mode === 'new' ? 'New site' : 'Rename project'} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); try { if (!name.trim()) throw new Error('Enter a project name.'); if (mode === 'new') onCreate(createSite({ name, width, depth, resolution, preset })); else onRename(name.trim()); setError(''); } catch (error) { setError(error instanceof Error ? error.message : 'The site could not be created.'); } }}>
    <Field>Project name<TextInput aria-label="Project name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></Field>
    {mode === 'new' && <><FieldGrid columns={'auto'}><NumberField label="Site width" value={width} min={20} max={200} onChange={setWidth} /><NumberField label="Site depth" value={depth} min={20} max={200} onChange={setDepth} /></FieldGrid><Field>Starting landscape<SelectInput aria-label="Starting landscape" value={preset} onValueChange={(value) => setPreset(value as 'coast' | 'flat')}><SelectOption value="coast">Coast with water</SelectOption><SelectOption value="flat">Flat ground</SelectOption></SelectInput></Field><Field>Terrain resolution<SelectInput aria-label="Terrain resolution" value={String(resolution)} onValueChange={(value) => setResolution(Number(value) as 129 | 257)}><SelectOption value="129">129 × 129</SelectOption><SelectOption value="257">257 × 257</SelectOption></SelectInput></Field><FieldMessage>This replaces the current scene. Undo restores it until you reopen the app. Export a copy to keep both projects.</FieldMessage></>}
    {error && <p role="alert" className="river-error">{error}</p>}
    <Button variant="default" className="primary-button" type="submit">{mode === 'new' ? 'Create site' : 'Save name'}</Button>
  </form></Dialog>;
}
