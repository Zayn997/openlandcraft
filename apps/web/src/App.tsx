import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowUp, ArrowDown, Box, Check, ChevronDown, ChevronRight, Copy, Equal, Eye, EyeOff, Focus, Grid2X2, Layers, Leaf, Mountain, MousePointer2, Pause, Play, Plus, Redo2, RotateCcw, Save, Settings2, Sparkles, Trash2, Undo2, Waves, X } from 'lucide-react';
import { Editor, createProject, createBuilding, createRiver, encodeGlb, evaluateProject, groundHeight, parseProject, snap, MAX_GLB_BYTES, type Asset, type Instance, type Block, type Entity, type Ocean } from '@openlandcraft/core';
import { deserializeProject, loadLocal, saveLocal, serializeProject, MAX_PROJECT_BYTES } from '@openlandcraft/project';
import { Viewport, validateModels, type TransformMode, type ViewportMetrics } from '@openlandcraft/viewport';
import { DEFAULT_BRUSH, MAX_HEIGHT, MIN_HEIGHT, TerrainStroke, type BrushSettings, type RiverPoint } from '@openlandcraft/landscape';
import { RiverInspector } from './RiverInspector';
import { SceneObjects } from "./SceneObjects";
import { Dialog, ProjectDialog } from './ProjectDialog';

function IconButton({ label, children, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; children: ReactNode }) {
  return <button {...props} type="button" aria-label={label} title={label} className={`icon-button ${active ? 'active' : ''} ${props.className ?? ''}`}>{children}</button>;
}

import { NumberField } from "./NumberField";
import { ConstructionInspector } from "./ConstructionInspector";

export function App() {
  const [editor] = useState(() => new Editor(createProject()));
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const project = state.preview ?? state.project;
  useEffect(() => { document.title = `OpenLandcraft — ${state.project.name}`; }, [state.project.name]);
  const selected = project.entities.find((entity) => entity.id === state.selectedId);
  const hasWater = project.entities.some((entity) => entity.visible && (entity.kind === 'ocean' || entity.kind === 'river'));
  const [grid, setGrid] = useState(true);
  const [playing, setPlaying] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [quality, setQuality] = useState<'low' | 'high'>('high');
  const [view, setView] = useState<'perspective' | 'top'>('perspective');
  const [frameToken, setFrameToken] = useState(0);
  const [metrics, setMetrics] = useState<ViewportMetrics | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Opening local project…');
  const [storageReady, setStorageReady] = useState(false);
  const [opening, setOpening] = useState(true);
  const [panel, setPanel] = useState<'scene' | 'inspector'>('scene');
  const [showHelp, setShowHelp] = useState(false);
  const [projectDialog, setProjectDialog] = useState<'new' | 'rename' | null>(null);
  const [storageRecovery, setStorageRecovery] = useState(false);
  const [inspectorEpoch, setInspectorEpoch] = useState(0);
  const [tool, setTool] = useState<'select' | 'terrain' | 'building' | 'river'>('select');
  const [riverDraft, setRiverDraft] = useState<RiverPoint[]>([]);
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [snapping, setSnapping] = useState(true);
  const [buildingCorner, setBuildingCorner] = useState<[number, number] | null>(null);
  const [importingModel, setImportingModel] = useState(false);
  const modelInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (selected?.kind !== 'instance' && transformMode === 'scale') setTransformMode('translate'); }, [selected?.kind, transformMode]);
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [strokeTime, setStrokeTime] = useState(0);
  const [stampPosition, setStampPosition] = useState<[number, number]>([-8, 8]);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let alive = true;
    loadLocal().then(async (saved) => {
      if (saved) await validateModels(saved.assets);
      if (!alive) return;
      if (saved) { editor.load(saved); editor.select(saved.entities.find((entity) => entity.kind === 'block')?.id ?? null); }
      setStorageReady(true);
      setOpening(false);
    }).catch((error: unknown) => {
      if (!alive) return;
      setError(error instanceof Error ? error.message : 'Local storage is unavailable. Export a copy to save your work.');
      setSaveStatus('Local storage unavailable');
      setStorageRecovery(true);
      setOpening(false);
    });
    return () => { alive = false; };
  }, [editor]);

  const queueSave = useCallback((manual = false) => {
    const committed = editor.getSnapshot().project;
    setSaveStatus('Saving…');
    saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveLocal(committed)).then(() => {
      if (editor.getSnapshot().project === committed) setSaveStatus('Saved locally');
      setStorageReady(true); setStorageRecovery(false);
      if (manual) setNotice('Project saved to this browser. Export a file for a portable copy.');
    }).catch((error: unknown) => {
      setSaveStatus('Save failed');
      setError(error instanceof Error ? error.message : 'Local save failed. Export a project file.');
    });
  }, [editor]);

  useEffect(() => {
    if (!storageReady || state.gestureLabel) return;
    setSaveStatus('Unsaved changes');
    const timer = setTimeout(() => queueSave(), 450);
    return () => clearTimeout(timer);
  }, [state.revision, state.gestureLabel, storageReady, queueSave]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const guard = useCallback((run: () => void) => {
    try { run(); setError(''); return true; } catch (error) { setError(error instanceof Error ? error.message : 'The edit could not be applied.'); return false; }
  }, []);
  const select = useCallback((id: string | null) => { editor.select(id); setRiverDraft([]); setBuildingCorner(null); setTool(id === 'terrain' ? 'terrain' : 'select'); setInspectorEpoch((value) => value + 1); if (id) setPanel('inspector'); }, [editor]);
  const cancelPreview = useCallback(() => { editor.cancel(); setRiverDraft([]); setBuildingCorner(null); setInspectorEpoch((value) => value + 1); }, [editor]);
  const frame = useCallback(() => setFrameToken((value) => value + 1), []);
  const chooseTool = (next: 'select' | 'terrain' | 'building' | 'river') => {
    editor.cancel(); setTool(next); setBuildingCorner(null); setRiverDraft([]);
    if (next === 'terrain') { editor.select('terrain'); setPanel('inspector'); }
  };
  const addRiver = (points?: RiverPoint[]) => guard(() => {
    editor.cancel(); const current = editor.getSnapshot().project;
    const river = createRiver(current); if (points) river.points = points;
    editor.execute({ type: 'add', entity: river }, 'Add river'); select(river.id); setNotice('River added. Drag numbered points or edit the river properties.');
  });
  const addBuilding = (x?: number, z?: number, width = 10, depth = 7) => guard(() => {
    editor.cancel(); const current = editor.getSnapshot().project;
    const centerX = x ?? Math.max(-current.site.width / 2 + width / 2 + 0.5, -Math.min(28, current.site.width * 0.25)), centerZ = z ?? Math.min(current.site.depth / 2 - depth / 2 - 0.5, current.site.depth * 0.2);
    const entities = createBuilding(current, centerX, centerZ, width, depth);
    editor.execute({ type: 'insert', entities }, 'Add building'); select(entities[0].id);
    setNotice('Building added. Select its level or individual walls, slab, and roof to edit.');
  });
  const groundPoint = (x: number, z: number) => {
    const next: [number, number] = [snap(x), snap(z)];
    if (tool === 'river') {
      guard(() => {
        if (riverDraft.length >= 16) throw new Error('Finish this river with up to 16 control points.');
        const current = editor.getSnapshot().project, y = Math.max(-7, Math.min(riverDraft.at(-1)?.[1] ?? 30, groundHeight(next[0], next[1], current.site) - 0.3));
        const points: RiverPoint[] = [...riverDraft, [next[0], y, next[1]]];
        if (points.length > 1) parseProject({ ...current, entities: [...current.entities, { ...createRiver(current), points }] });
        setRiverDraft(points);
      }); return;
    }
    if (!buildingCorner) { setBuildingCorner(next); return; }
    const width = Math.abs(next[0] - buildingCorner[0]), depth = Math.abs(next[1] - buildingCorner[1]);
    if (width < 1 || depth < 1 || width > 99 || depth > 99) { setError('Choose a footprint between 1 and 99 m on each side.'); return; }
    addBuilding((next[0] + buildingCorner[0]) / 2, (next[1] + buildingCorner[1]) / 2, width, depth);
  };
  const placeAsset = (asset: Asset, extraAssets: Asset[] = []) => guard(() => {
    editor.cancel(); const current = editor.getSnapshot().project;
    const count = current.entities.filter((entity) => entity.kind === 'instance').length;
    const entity: Instance = { id: crypto.randomUUID(), parentId: 'site', kind: 'instance', name: `${asset.name.slice(0, 65)}${count ? ` ${count + 1}` : ''}`, visible: true, assetId: asset.id, position: [-29 * current.site.width / 90 + count % 5 * Math.min(3, current.site.width / 15), 0, -8 * current.site.depth / 72 + Math.floor(count / 5) % 5 * Math.min(3, current.site.depth / 12)], rotation: 0, scale: [1, 1, 1], anchor: 'terrain' };
    editor.execute({ type: 'insert', assets: extraAssets, entities: [entity] }, 'Place model'); select(entity.id);
  });
  const importModel = async (file: File | undefined) => {
    if (!file || importingModel) return;
    const destination = editor.getSnapshot().project;
    setImportingModel(true);
    try {
      if (file.size > MAX_GLB_BYTES) throw new Error('Use a GLB smaller than 8 MB.');
      const asset: Asset = { id: crypto.randomUUID(), name: file.name.replace(/\.glb$/i, '').slice(0, 80) || 'Imported model', data: encodeGlb(new Uint8Array(await file.arrayBuffer())), attribution: file.name === 'Coastal pine.glb' ? 'Original OpenLandcraft procedural demo tree; CC0-1.0.' : '' };
      await validateModels([asset]);
      if (editor.getSnapshot().project !== destination) throw new Error('The scene changed while the model was loading. Import it again in the current project.');
      const existing = editor.getSnapshot().project.assets.find((source) => source.data === asset.data);
      if (!placeAsset(existing ?? asset, existing ? [] : [asset])) return;
      setNotice('Model embedded and placed. Use the handles or numeric properties to move it.');
    } catch (error) { setError(error instanceof Error ? error.message : 'The model could not be imported.'); }
    finally { setImportingModel(false); if (modelInput.current) modelInput.current.value = ''; }
  };
  const previewStamp = () => guard(() => {
    editor.cancel(); editor.select('terrain');
    const baseline = editor.getSnapshot().project;
    const stamp = new TerrainStroke(baseline.site.terrain, baseline.site, brush);
    stamp.move(...stampPosition);
    editor.begin(`${brush.kind[0].toUpperCase() + brush.kind.slice(1)} stamp`);
    editor.preview({ type: 'terrain', field: stamp.snapshot() });
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (opening || importingModel) return;
      if (event.key === 'Escape') { cancelPreview(); setShowHelp(false); return; }
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable=true]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); event.shiftKey ? editor.redo() : editor.undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault(); editor.redo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); queueSave(true);
      } else if (event.key.toLowerCase() === 'f') frame();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, frame, queueSave, opening, importingModel, cancelPreview]);

  const preview = (entity: Entity) => guard(() => {
    if (!editor.getSnapshot().gestureLabel) editor.begin(`Edit ${entity.name}`);
    const assets = editor.getSnapshot().preview?.assets ?? [];
    editor.preview({ type: 'batch', commands: [{ type: 'replace', entity }, ...assets.filter((asset) => editor.getSnapshot().project.assets.find((source) => source.id === asset.id)?.attribution !== asset.attribution).map((asset) => ({ type: 'asset' as const, asset }))] });
  });
  const changeBlock = (changes: Partial<Block>) => { if (selected?.kind === 'block') preview({ ...selected, ...changes }); };
  const changeOcean = (changes: Partial<Ocean>) => { if (selected?.kind === 'ocean') preview({ ...selected, ...changes }); };
  const addBlock = () => guard(() => {
    editor.cancel();
    setTool('select');
    const count = state.project.entities.filter((entity) => entity.kind === 'block').length;
    const x = Math.max(-state.project.site.width / 2 + 3.5, -state.project.site.width * 0.2 - (count % 3) * Math.min(5, state.project.site.width * 0.08)), z = Math.min(state.project.site.depth / 2 - 3, state.project.site.depth * 0.1 + (Math.floor(count / 3) % 3) * Math.min(7, state.project.site.depth * 0.1));
    const block: Block = { id: crypto.randomUUID(), parentId: 'site', kind: 'block', visible: true, name: `Massing ${String(count + 1).padStart(2, '0')}`, position: [x, groundHeight(x, z, evaluateProject(state.project).site) + 0.1, z], size: [6, 4, 5], rotation: 0, color: '#ded8ca' };
    editor.execute({ type: 'add', entity: block }, 'Add massing block'); editor.select(block.id);
    setPanel('inspector'); setNotice('Massing block added. Edit its dimensions and position in the inspector.');
  });
  const duplicate = () => guard(() => {
    if (!selected || selected.kind !== 'block') return;
    editor.cancel();
    const entity: Block = { ...selected, id: crypto.randomUUID(), name: `${selected.name.slice(0, 65)} copy`, position: [selected.position[0] - 3, selected.position[1], selected.position[2] + 4] };
    editor.execute({ type: 'add', entity }, 'Duplicate block'); editor.select(entity.id);
  });
  const exportProject = () => guard(() => {
    const committed = editor.getSnapshot().project;
    const blob = new Blob([serializeProject(committed)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `${committed.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.olc.json`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(state.gestureLabel ? 'Exported the committed scene. Apply your preview to include pending edits.' : 'Portable project exported.');
  });
  const importProject = async (file: File | undefined) => {
    if (!file) return;
    setOpening(true);
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('This project exceeds the 40 MB limit.');
      const parsed = deserializeProject(await file.text());
      await validateModels(parsed.assets);
      editor.load(parsed); setTool('select'); setRiverDraft([]); setBuildingCorner(null); setFrameToken((value) => value + 1); setView('perspective');
      setStorageReady(true); queueSave();
      setError(''); setNotice('Project opened. Session history has been reset.');
    } catch (error) { setError(error instanceof Error ? error.message : 'The project could not be opened.'); }
    finally { setOpening(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  return <div className="app">
    <a href="#inspector" className="skip-link">Skip to object inspector</a>
    <header className="app-header">
      <a className="brand" href="#" aria-label="OpenLandcraft home" onClick={(event) => event.preventDefault()}><span className="brand-symbol"><Mountain size={25} strokeWidth={1.6} /></span><span>openlandcraft<span className="brand-dot">.</span></span></a>
      <div className="header-divider" />
      <div className="project-title"><button className="project-name-button" aria-label="Rename project" onClick={() => setProjectDialog('rename')}>{state.project.name}</button><span className="local-pill">LOCAL</span></div>
      <div className="header-actions">
        <div className="history-buttons"><IconButton label="Undo (Ctrl Z)" disabled={!state.past.length && !state.gestureLabel} onClick={() => editor.undo()}><Undo2 size={17} /></IconButton><IconButton label="Redo (Ctrl Shift Z)" disabled={!state.future.length || !!state.gestureLabel} onClick={() => editor.redo()}><Redo2 size={17} /></IconButton></div>
        <button className="text-button" aria-label="New site" title="Create a new site" onClick={() => setProjectDialog('new')}><Plus size={16} /><span>New</span></button>
        <button className="text-button open-button" aria-label="Open" title="Open project file" onClick={() => fileInput.current?.click()}><ArrowUpFromLine size={16} /><span>Open</span></button>
        <button className="text-button" aria-label="Export" title="Export project file" onClick={exportProject}><ArrowDownToLine size={16} /><span>Export</span></button>
        <button className="primary-button" aria-label="Save project" title="Save project locally" onClick={() => queueSave(true)}><Save size={16} /><span>Save project</span></button>
      </div>
      <input ref={fileInput} type="file" accept=".json,.olc.json,application/json" className="visually-hidden" aria-label="Open project file" onChange={(event) => void importProject(event.target.files?.[0])} />
    </header>

    <div className="workspace">
      <aside className={`scene-panel ${panel === 'scene' ? 'mobile-active' : ''}`} aria-label="Scene hierarchy">
        <div className="panel-heading"><span>WORKSPACE</span><span className="version-tag">M4</span></div>
        <button className="sidebar-project-name" aria-label="Rename project" onClick={() => setProjectDialog('rename')}>{state.project.name}</button>
        <div className="workspace-name"><div className="workspace-icon"><Layers size={19} /></div><div><strong>Site workspace</strong><span>Independent editor prototype</span></div></div>
        <div className="scene-heading"><span>SCENE</span><span>{project.entities.length + 1} objects</span></div>
        <div className="site-row"><ChevronDown size={14} /><Mountain size={16} /><span>Site · {project.site.width} × {project.site.depth} m</span></div>
        <div className="tree-list" role="list" aria-label="Scene objects">
          <div className={`tree-row ${state.selectedId === 'terrain' ? 'selected' : ''}`} role="listitem"><button className="tree-select" aria-pressed={state.selectedId === 'terrain'} onClick={() => select('terrain')}><span className="tree-guide" /><Mountain size={15} /><span>Site terrain</span></button><span className="small-tag">EDIT</span></div>
          <SceneObjects entities={project.entities} selectedId={state.selectedId} editor={editor} onSelect={select} guard={guard} />
        </div>
        <button className="add-object" onClick={addBlock}><Plus size={15} />Add massing block</button>
        <div className="creation-tools"><button onClick={() => addBuilding()}><Layers size={14} />Add building</button><button aria-pressed={tool === 'building'} onClick={() => { chooseTool('building'); setView('top'); }}><Focus size={14} />Draw footprint</button><button disabled={importingModel} onClick={() => modelInput.current?.click()}><ArrowUpFromLine size={14} />{importingModel ? 'Reading GLB…' : 'Import GLB'}</button><button disabled={importingModel} onClick={() => { void fetch('/models/openlandcraft-pine.glb').then((response) => { if (!response.ok) throw new Error('Demo model could not load.'); return response.blob(); }).then((blob) => importModel(new File([blob], 'Coastal pine.glb'))).catch((error: Error) => setError(error.message)); }}><Leaf size={14} />Demo tree</button></div>
        <input ref={modelInput} type="file" accept=".glb,model/gltf-binary" className="visually-hidden" aria-label="Import GLB model" onChange={(event) => void importModel(event.target.files?.[0])} />
        <div className="creation-tools river-creation"><button disabled={project.entities.some((entity) => entity.kind === 'river')} onClick={() => addRiver()}><Waves size={14} />Add river</button><button disabled={project.entities.some((entity) => entity.kind === 'river')} aria-pressed={tool === 'river'} onClick={() => { chooseTool('river'); setView('top'); }}><MousePointer2 size={14} />Draw river</button></div>
        {project.assets.length > 0 && <section className="asset-library" aria-label="Model library"><h3>MODEL LIBRARY</h3>{project.assets.map((asset) => { const used = project.entities.some((entity) => entity.kind === 'instance' && entity.assetId === asset.id); return <div key={asset.id}><span title={asset.name}>{asset.name}</span><button disabled={!!state.gestureLabel} onClick={() => placeAsset(asset)} aria-label={`Place ${asset.name}`} title="Place another instance"><Plus size={14} /></button><button disabled={used || !!state.gestureLabel} aria-label={`Remove source ${asset.name}`} title={used ? 'Delete its instances before removing the source' : 'Remove unused model source'} onClick={() => guard(() => editor.execute({ type: 'removeAsset', id: asset.id }, 'Remove model source'))}><Trash2 size={13} /></button></div>; })}</section>}
        <div className="sidebar-bottom"><div className="research-label"><Leaf size={15} /><span>Built from our own core</span></div><p>A place to shape land,<br />water, and architecture.</p><div className="sidebar-foot"><span>OPENLANDCRAFT</span><span>0.0.1</span></div></div>
      </aside>

      <main className="stage" aria-label="3D editor">
        <div className="stage-toolbar"><div className="breadcrumb">Projects <ChevronRight size={12} /><strong>{state.project.name}</strong></div><span className="stage-title"><span className="status-dot" />Live scene</span></div>
        <div className="viewport-area">
          <Viewport project={project} selectedId={state.selectedId} onSelect={select} grid={grid} playing={playing} quality={quality} view={view} frameToken={frameToken} onMetrics={setMetrics} editor={editor} tool={tool} brush={brush} onStrokeTime={setStrokeTime} onGroundPoint={groundPoint} onError={setError} transformMode={transformMode} snapping={snapping} riverDraft={riverDraft} />
          <div className="view-label"><span className="view-label-icon"><Layers size={15} /></span><div><strong>{view === 'perspective' ? 'Perspective' : 'Top view'}</strong><span>Concept study / meters</span></div></div>
          <div className="view-switch" role="group" aria-label="Camera view"><button aria-pressed={view === 'perspective'} className={view === 'perspective' ? 'chosen' : ''} onClick={() => setView('perspective')}>3D</button><button aria-pressed={view === 'top'} className={view === 'top' ? 'chosen' : ''} onClick={() => setView('top')}>Top</button></div>
          <div className="viewport-tools"><IconButton label="Selection tool" active={tool === 'select'} onClick={() => chooseTool('select')}><MousePointer2 size={19} /></IconButton><IconButton label="Sculpt terrain" active={tool === 'terrain'} onClick={() => chooseTool('terrain')}><Mountain size={19} /></IconButton><div className="tool-divider" /><IconButton label="Add massing block" onClick={addBlock}><Plus size={20} /></IconButton><IconButton label="Frame selection (F)" onClick={frame}><Focus size={19} /></IconButton><div className="tool-divider" /><IconButton label="Toggle ground grid" active={grid} onClick={() => setGrid((value) => !value)}><Grid2X2 size={18} /></IconButton></div>
          {tool === 'select' && selected && (selected.kind === 'instance' || selected.kind === 'level' || selected.kind === 'block') && <div className="transform-tools" role="group" aria-label="Transform tools">{(['translate', 'rotate', ...(selected.kind === 'instance' ? ['scale'] : [])] as TransformMode[]).map((mode) => <button key={mode} aria-pressed={transformMode === mode} onClick={() => { editor.cancel(); setTransformMode(mode); }}>{mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale'}</button>)}<label><input type="checkbox" checked={snapping} onChange={(event) => setSnapping(event.target.checked)} />Snap</label></div>}
          {tool === 'building' && <div className="building-hud" role="status"><Layers size={15} /><span>{buildingCorner ? `First corner ${buildingCorner.join(', ')} m · Choose opposite corner` : 'Choose the first footprint corner on land'}</span><button onClick={() => chooseTool('select')}>Cancel</button></div>}
          {tool === 'river' && <div className="building-hud river-hud" role="status"><Waves size={15} /><span>{riverDraft.length ? `${riverDraft.length} points · Choose next downstream point` : 'Choose the first upstream point on land'}</span><button disabled={riverDraft.length < 2} onClick={() => addRiver(riverDraft)}>Finish river</button><button disabled={!riverDraft.length} onClick={() => setRiverDraft((points) => points.slice(0, -1))}>Back</button><button onClick={() => chooseTool('select')}>Cancel</button></div>}
          <div className="scene-caption"><span className="eyebrow">STUDY 001</span><h1>{state.project.name}</h1><p>Land, architecture, and planted models</p></div>
          <div className="north-marker"><span>N</span><svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 2 25 31 16 24 7 31Z" fill="#465348" /><path d="M16 2v22l9 7Z" fill="#a1ac99" /></svg></div>
          <div className="playback-bar"><IconButton disabled={!hasWater} label={playing ? 'Pause water animation' : 'Play water animation'} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={14} /> : <Play size={14} />}</IconButton><span>{hasWater ? 'Water study' : 'No water surfaces'}</span><span className="playback-dot" /><span className="playback-state">{hasWater ? playing ? 'Playing' : 'Paused' : '—'}</span><select aria-label="Preview quality" value={quality} onChange={(event) => setQuality(event.target.value as 'low' | 'high')}><option value="high">High quality</option><option value="low">Low quality</option></select></div>
          <div className="navigation-hint">{tool === 'terrain' ? 'Drag to sculpt · Esc cancels · Select tool to navigate' : tool === 'river' ? 'Click downstream points · Finish commits · Esc clears draft' : tool === 'building' ? 'Click two footprint corners · Esc clears draft' : view === 'top' ? 'Drag to pan · Scroll to zoom' : <>Drag to orbit<span>·</span>Right-drag to pan<span>·</span>Scroll to zoom</>}</div>
          {tool === 'terrain' && <div className="brush-hud"><Mountain size={13} /><strong>{brush.kind[0].toUpperCase() + brush.kind.slice(1)}</strong><span>Radius {brush.radius} m</span><kbd>Esc</kbd><span>cancel</span></div>}
        </div>
        <footer className="statusbar"><span><span className={`status-dot ${saveStatus === 'Save failed' ? 'warning' : ''}`} />{saveStatus}</span><div><span>{metrics ? `${metrics.fps} FPS` : 'Starting renderer…'}</span><span>WebGL 2</span><span>1 unit = 1 m</span><button onClick={() => setShowHelp(true)} aria-label="Show editor help">?</button></div></footer>
      </main>

      <aside id="inspector" className={`inspector ${panel === 'inspector' ? 'mobile-active' : ''}`} aria-label="Object inspector">
        <div className="inspector-header"><span>PROPERTIES</span><Settings2 size={15} /></div>
        {state.selectedId === 'terrain' ? <div className="inspector-content terrain-inspector">
          <div className="object-heading"><div className="object-icon"><Mountain size={24} /></div><div><h2>Site terrain</h2><span>Editable heightfield</span></div></div>
          <section className="property-section"><h3>Sculpt</h3><div className="brush-kinds">{([{kind:'raise',label:'Raise',Icon:ArrowUp},{kind:'lower',label:'Lower',Icon:ArrowDown},{kind:'flatten',label:'Flatten',Icon:Equal},{kind:'smooth',label:'Smooth',Icon:Sparkles}] as const).map(({kind,label,Icon}) => <button key={kind} aria-pressed={brush.kind === kind} disabled={!!state.gestureLabel} className={brush.kind === kind ? 'chosen' : ''} onClick={() => { setBrush((value) => ({...value,kind})); setTool('terrain'); }}><Icon size={17} />{label}</button>)}</div></section>
          <section className="property-section"><h3>Brush settings</h3><label className="brush-slider">Radius<span>{brush.radius.toFixed(1)} m</span><input aria-label="Brush radius" type="range" min="1" max="20" step="0.5" value={brush.radius} disabled={!!state.gestureLabel} onChange={(event) => setBrush((value) => ({...value,radius:Number(event.target.value)}))} /></label><label className="brush-slider">Strength<span>{Math.round(brush.strength * 100)}%</span><input aria-label="Brush strength" type="range" min="0.05" max="1" step="0.05" value={brush.strength} disabled={!!state.gestureLabel} onChange={(event) => setBrush((value) => ({...value,strength:Number(event.target.value)}))} /></label>{brush.kind === 'flatten' && <NumberField label="Flatten elevation" value={brush.target} min={MIN_HEIGHT} max={MAX_HEIGHT} onChange={(target) => setBrush((value) => ({...value,target}))} />}</section>
          <section className="property-section"><h3>Terrain data</h3><div className="read-only-row"><span>Grid</span><span>{project.site.terrain.columns} × {project.site.terrain.rows}</span></div><div className="read-only-row"><span>Height range</span><span>{MIN_HEIGHT} to {MAX_HEIGHT} m</span></div><div className="read-only-row"><span>Preview latency</span><span>{strokeTime ? `${strokeTime.toFixed(1)} ms` : '—'}</span></div></section>
          <details className="stamp-placement"><summary>Place a stamp with coordinates</summary><form onSubmit={(event) => { event.preventDefault(); previewStamp(); }}><fieldset disabled={!!state.gestureLabel}><NumberField label="Stamp X" value={stampPosition[0]} min={-project.site.width / 2} max={project.site.width / 2} onChange={(x) => setStampPosition((value) => [x,value[1]])} /><NumberField label="Stamp Z" value={stampPosition[1]} min={-project.site.depth / 2} max={project.site.depth / 2} onChange={(z) => setStampPosition((value) => [value[0],z])} /><button type="submit" className="text-button">Preview stamp</button></fieldset></form>{state.gestureLabel?.endsWith('stamp') && <div className="stamp-actions"><button className="primary-button" onClick={() => editor.commit()}><Check size={14} />Apply stamp</button><button className="text-button" onClick={cancelPreview}>Cancel stamp</button></div>}</details>
          <div className="terrain-instructions"><strong>{state.gestureLabel ?? (tool === 'terrain' ? 'Ready to sculpt' : 'Navigation mode')}</strong><p>Drag on the ground to sculpt. Release to commit one undo step. Escape cancels the current stroke.</p><button className="primary-button" onClick={() => chooseTool(tool === 'terrain' ? 'select' : 'terrain')}>{tool === 'terrain' ? <MousePointer2 size={15} /> : <Mountain size={15} />}{tool === 'terrain' ? 'Switch to navigation' : 'Sculpt terrain'}</button></div><p className="scope-note">Building elevations stay fixed while terrain changes. Water depth updates from the edited ground.</p>
        </div> : selected?.kind === 'river' ? <RiverInspector key={`${selected.id}-${state.revision}-${inspectorEpoch}`} river={selected} editor={editor} cancel={cancelPreview} /> : selected && selected.kind !== 'block' && selected.kind !== 'ocean' ? <ConstructionInspector key={`${selected.id}-${state.revision}-${inspectorEpoch}`} selected={selected} project={project} editor={editor} preview={preview} cancel={cancelPreview} onSelect={select} guard={guard} /> : selected ? <form className="inspector-content" key={`${selected.id}-${state.revision}-${inspectorEpoch}`} onInputCapture={() => guard(() => { if (!editor.getSnapshot().gestureLabel) editor.begin(`Edit ${selected.name}`); })} onSubmit={(event) => { event.preventDefault(); guard(() => editor.commit()); }}>
          <div className="object-heading"><div className="object-icon">{selected.kind === 'block' ? <Box size={23} strokeWidth={1.4} /> : <Waves size={24} strokeWidth={1.4} />}</div><div><h2>{selected.name}</h2><span>{selected.kind === 'block' ? 'Massing block' : 'Experimental ocean surface'}</span></div></div>
          <section className="property-section"><h3>Object</h3><label className="name-field">Name<input aria-label="Object name" value={selected.name} maxLength={80} onChange={(event) => { if (event.target.value.trim()) preview({ ...selected, name: event.target.value }); }} /></label><div className="read-only-row"><span>Parent</span><span><Mountain size={13} />Site</span></div></section>
          {selected.kind === 'block' ? <>
            <section className="property-section"><h3>Dimensions<span>METERS</span></h3><div className="dimension-fields">{(['Width', 'Height', 'Depth'] as const).map((label, index) => <NumberField key={label} label={label} value={selected.size[index]} min={0.2} max={100} onChange={(value) => { const size: Block['size'] = [...selected.size]; size[index] = value; changeBlock({ size }); }} />)}</div></section>
            <section className="property-section"><h3>Position<span>LOCAL</span></h3><div className="position-fields">{(['X position', 'Y position', 'Z position'] as const).map((label, index) => <NumberField key={label} label={label} value={selected.position[index]} min={index === 1 ? -50 : -500} max={index === 1 ? 100 : 500} onChange={(value) => { const position: Block['position'] = [...selected.position]; position[index] = value; changeBlock({ position }); }} />)}</div><NumberField label="Rotation" value={selected.rotation} min={-360} max={360} step={1} unit="°" onChange={(rotation) => changeBlock({ rotation })} /></section>
          </> : <section className="property-section"><h3>Water settings</h3><div className="water-fields"><NumberField label="Water level" value={selected.level} min={-8} max={8} onChange={(level) => changeOcean({ level })} /><NumberField label="Wave amplitude" value={selected.amplitude} min={0} max={0.8} step={0.02} onChange={(amplitude) => changeOcean({ amplitude })} /><NumberField label="Wave speed" value={selected.speed} min={0} max={3} step={0.1} unit="×" onChange={(speed) => changeOcean({ speed })} /></div><p className="field-hint">Shore depth follows the same terrain data as the land surface.</p></section>}
          <section className="property-section"><h3>Appearance</h3><label className="color-field"><input aria-label="Object color" type="color" value={selected.color} onChange={(event) => preview({ ...selected, color: event.target.value })} /><span>Base color</span><code>{selected.color.toUpperCase()}</code></label></section>
          <div className={`edit-actions ${state.gestureLabel ? 'has-preview' : ''}`}><div><span className="status-dot" />{state.gestureLabel ? 'Previewing changes' : 'All changes applied'}</div><button type="submit" className="primary-button" disabled={!state.gestureLabel}><Check size={15} />Apply changes</button><button type="button" className="cancel-button" disabled={!state.gestureLabel} onClick={cancelPreview}><RotateCcw size={13} />Cancel preview<span>Esc</span></button></div>
          <div className="object-actions">{selected.kind === 'block' && <button type="button" disabled={!!state.gestureLabel} onClick={duplicate}><Copy size={14} />Duplicate</button>}<button type="button" disabled={!!state.gestureLabel} className="delete-button" onClick={() => guard(() => editor.execute({ type: 'remove', id: selected.id }, `Delete ${selected.name}`))}><Trash2 size={14} />Delete</button></div>
          <p className="scope-note">{selected.kind === 'block' ? 'Concept massing. Add a building for separate levels, walls, slabs, and roofs.' : 'Water experiment. Breaking surf, foam history, and underwater views are future work.'}</p>
        </form> : <div className="empty-inspector"><MousePointer2 size={26} /><h2>Select an object</h2><p>Pick an object in the viewport or scene list to edit its properties.</p><button className="text-button" onClick={addBlock}><Plus size={16} />Add a block</button></div>}
      </aside>
    </div>
    <nav className="mobile-panels" aria-label="Editor panels"><button className={panel === 'scene' ? 'chosen' : ''} onClick={() => setPanel('scene')}><Layers size={15} />Scene</button><button className={panel === 'inspector' ? 'chosen' : ''} onClick={() => setPanel('inspector')}><Settings2 size={15} />Properties</button></nav>
    {(opening || importingModel) && <div className="opening-overlay" role="status">{importingModel ? 'Reading and validating GLB…' : 'Opening local project…'}</div>}
    {storageRecovery && !opening && <div className="recovery-banner" role="status">Autosave paused. Open a valid project, create a new site, or Save project to replace the unreadable local copy.</div>}
    {projectDialog && <ProjectDialog mode={projectDialog} project={state.project} onClose={() => setProjectDialog(null)} onCreate={(project) => {
      editor.replaceProject(project, 'Create new site'); select(null); setFrameToken((value) => value + 1); setView('perspective'); setProjectDialog(null); setStorageReady(true); queueSave(); setNotice('New site created. Undo restores the previous scene.');
    }} onRename={(name) => { editor.cancel(); editor.execute({ type: 'rename', name }, 'Rename project'); setProjectDialog(null); }} />}
    {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
    {showHelp && <Dialog title="Editor help" onClose={() => setShowHelp(false)}><span className="eyebrow">OPENLANDCRAFT / M4</span><h3>{state.project.name}</h3><p>Import a GLB or add a building from Scene. Select an object to edit its properties, or sculpt the terrain.</p><dl><dt>Navigate</dt><dd>Select tool · drag to orbit · right-drag to pan · scroll to zoom</dd><dt>Focus</dt><dd>F or the frame button</dd><dt>History</dt><dd>Ctrl/Cmd Z · Ctrl/Cmd Shift Z</dd><dt>Cancel preview</dt><dd>Escape</dd><dt>Save</dt><dd>Ctrl/Cmd S · Export for a portable file</dd></dl><p className="field-hint">Terrain supports raise, lower, flatten, and smooth. Drag to sculpt; release to commit one undo step. Coordinate stamps provide keyboard editing. Draw footprint creates a building from two snapped corners. Move, Rotate, and Scale handles commit on release. Models can follow the ground; buildings keep fixed elevations. Add river creates an editable channel. Draw river accepts upstream-to-downstream clicks; Finish commits. Drag numbered points in plan and set elevations in Properties.</p>{metrics && <p className="renderer-info">{metrics.renderer}<br />{metrics.calls} draw calls · {metrics.triangles.toLocaleString()} triangles</p>}</Dialog>}
  </div>;
}
