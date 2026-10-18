import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createSite, type Project } from '@openlandcraft/core';
import { NumberField } from './NumberField';

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="dialog-backdrop" onClick={onClose}><section ref={ref} className="help-dialog project-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && ['z', 'y', 's'].includes(event.key.toLowerCase())) { event.stopPropagation(); if (event.key.toLowerCase() === 's') event.preventDefault(); }
    if (event.key === 'Escape') { event.stopPropagation(); close.current(); }
    if (event.key === 'Tab') {
      const controls = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')];
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0]?.focus(); }
    }
  }}><button className="dialog-close icon-button" type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={18} /></button><h2>{title}</h2>{children}</section></div>;
}

export function ProjectDialog({ mode, project, onClose, onCreate, onRename }: {
  mode: 'new' | 'rename'; project: Project; onClose: () => void; onCreate: (project: Project) => void; onRename: (name: string) => void;
}) {
  const [name, setName] = useState(mode === 'new' ? 'Untitled site' : project.name), [width, setWidth] = useState(90), [depth, setDepth] = useState(72);
  const [resolution, setResolution] = useState<129 | 257>(129), [preset, setPreset] = useState<'coast' | 'flat'>('coast'), [error, setError] = useState('');
  return <Dialog title={mode === 'new' ? 'New site' : 'Rename project'} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); try { if (!name.trim()) throw new Error('Enter a project name.'); if (mode === 'new') onCreate(createSite({ name, width, depth, resolution, preset })); else onRename(name.trim()); setError(''); } catch (error) { setError(error instanceof Error ? error.message : 'The site could not be created.'); } }}>
    <label className="name-field">Project name<input aria-label="Project name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
    {mode === 'new' && <><div className="construction-fields"><NumberField label="Site width" value={width} min={20} max={200} onChange={setWidth} /><NumberField label="Site depth" value={depth} min={20} max={200} onChange={setDepth} /></div><label className="select-field">Starting landscape<select aria-label="Starting landscape" value={preset} onChange={(event) => setPreset(event.target.value as 'coast' | 'flat')}><option value="coast">Coast with water</option><option value="flat">Flat ground</option></select></label><label className="select-field">Terrain resolution<select aria-label="Terrain resolution" value={resolution} onChange={(event) => setResolution(Number(event.target.value) as 129 | 257)}><option value={129}>129 × 129</option><option value={257}>257 × 257</option></select></label><p className="field-hint">This replaces the current scene. Undo restores it until you reopen the app. Export a copy to keep both projects.</p></>}
    {error && <p role="alert" className="river-error">{error}</p>}
    <button className="primary-button" type="submit">{mode === 'new' ? 'Create site' : 'Save name'}</button>
  </form></Dialog>;
}
