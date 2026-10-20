import { Panel, Row, SelectInput, SelectOption, TextInput, TreeRow } from './ui';
import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Crosshair, Eye, EyeOff, FolderPlus, LockKeyhole, Plus, ScanEye, Search, Settings2, UnlockKeyhole } from 'lucide-react';
import { canEditObject, layerState, objectLayer, type Command, type Editor, type Layer, type Project } from '@openlandcraft/core';

import { InlineRename } from './InlineRename';
import { LayerMenu, type LayerMenuAnchor } from './LayerMenu';

type Props = { project: Project; editor: Editor; selectedIds: string[]; isolatedId: string | null; guard: (run: () => void) => unknown; onSelectObjects: (ids: string[]) => void };
export function LayersPanel({ project, editor, selectedIds, isolatedId, guard, onSelectObjects }: Props) {
  const [picked, setPicked] = useState('default');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [renaming,setRenaming]=useState<string|null>(null);
  const [menu,setMenu]=useState<LayerMenuAnchor|null>(null);
  const tree = useRef<HTMLDivElement>(null);
  const layer = project.layers.find(l => l.id === picked) ?? project.layers[0];
  const ids = ['terrain', ...project.entities.map(e => e.id)];
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const id of ['terrain', ...project.entities.map(e => e.id)]) { const key = objectLayer(project, id); result.set(key, (result.get(key) ?? 0) + 1); }
    return result;
  }, [project.entities, project.objectLayers]);
  const execute = (command: Command, label: string) => guard(() => { editor.cancel(); editor.execute(command, label); });
  const update = (value: Layer) => {
    const previous=project.layers.find(l=>l.id===value.id);
    const result=execute({ type: 'layer', layer: value }, 'Edit layer ' + value.name);
    if(result!==false&&previous?.parentId!==value.parentId) {
      const ancestors:string[]=[];
      let parent=value.parentId;
      while(parent){ancestors.push(parent);parent=project.layers.find(l=>l.id===parent)?.parentId??null;}
      setExpanded(before=>new Set([...before,...ancestors]));
    }
    return result;
  };
  const add = (parentId: string | null) => {
    const names = new Set(project.layers.filter(l => l.parentId === parentId).map(l => l.name.toLowerCase()));
    let name = 'New layer', n = 2; while (names.has(name.toLowerCase())) name = 'New layer ' + n++;
    const id = crypto.randomUUID();
    execute({ type: 'layer', layer: { id, parentId, name, visible: true, locked: false, color: '#c8d9ac' } }, 'Create layer');
    if (parentId) setExpanded(before => new Set([...before, parentId]));
    setPicked(id); setRenaming(id); setQuery(''); setFilter('all');
  };
  const toggle = (id: string, open: boolean) => setExpanded(before => { const next = new Set(before); if (open) next.add(id); else next.delete(id); return next; });
  const reveal = () => {
    if (!selectedIds.length) return;
    const id = objectLayer(project, selectedIds[0]);
    const ancestors: string[] = [];
    let parent = project.layers.find(l => l.id === id)?.parentId;
    while (parent) { ancestors.push(parent); parent = project.layers.find(l => l.id === parent)?.parentId; }
    setExpanded(before => new Set([...before, ...ancestors])); setPicked(id); setQuery(''); setFilter('all');
    requestAnimationFrame(() => tree.current?.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }));
  };
  const matches = (item: Layer) => item.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || filter === 'used' && (counts.get(item.id) ?? 0) > 0 || filter === 'hidden' && !layerState(project, item.id).visible || filter === 'locked' && layerState(project, item.id).locked);
  const children = (id: string | null) => project.layers.filter(l => l.parentId === id);
  const searching = !!query || filter !== 'all';
  const hasMatch = (item: Layer): boolean => matches(item) || children(item.id).some(hasMatch);
  const rows: { item: Layer; depth: number }[] = [];
  const visit = (parent: string | null, depth: number) => { for (const item of children(parent)) { if (searching && !hasMatch(item)) continue; rows.push({ item, depth }); if (expanded.has(item.id) || searching) visit(item.id, depth + 1); } };
  visit(null, 0);
  const active = project.layers.find(l => l.id === project.activeLayerId);
  const canMove = selectedIds.length > 0 && selectedIds.every(id => canEditObject(project, id, isolatedId));
  return <Panel className="layers-panel" aria-label="Layers">
    <Row className="organizer-search"><Search size={14}/><TextInput appearance="plain" aria-label="Search layers" placeholder="Search layers…" value={query} onChange={e => setQuery(e.target.value)}/><SelectInput appearance="plain" aria-label="Filter layers" value={filter} onValueChange={(value) => setFilter(value)}><SelectOption value="all">All</SelectOption><SelectOption value="used">Used</SelectOption><SelectOption value="hidden">Hidden</SelectOption><SelectOption value="locked">Locked</SelectOption></SelectInput></Row>
    <Row className="layer-toolbar"><button title="New layer" aria-label="New layer" onClick={() => add(null)}><Plus size={15}/></button><button title="New sublayer" aria-label="New sublayer" onClick={() => add(layer.id)}><FolderPlus size={15}/></button><button title="Reveal selected object's layer" aria-label="Reveal selected object's layer" disabled={!selectedIds.length} onClick={reveal}><Crosshair size={15}/></button><span>{project.layers.length} layers</span><button title="Layer actions · also available on right-click" aria-label="Layer actions" aria-haspopup="menu" aria-expanded={!!menu} onClick={e => {const rect=e.currentTarget.getBoundingClientRect();setMenu({id:layer.id,x:rect.left,y:rect.bottom,target:e.currentTarget});}}><Settings2 size={15}/></button></Row>
    {isolatedId && <Row className="layer-isolation"><ScanEye size={14}/><span>Layer isolated</span><button onClick={() => editor.isolateLayer(null)}>Restore</button></Row>}
    <div className="layer-tree organizer-scroll" role="tree" aria-label="Layer hierarchy" ref={tree}>
      {rows.map(({ item, depth }, index) => {
        const status = layerState(project, item.id), nested = children(item.id).length > 0, open = searching || expanded.has(item.id);
        return <TreeRow key={item.id} data-layer-id={item.id} role="treeitem" aria-level={depth + 1} aria-selected={item.id === layer.id} aria-expanded={nested ? open : undefined} tabIndex={item.id === layer.id || index === 0 && !rows.some(r => r.item.id === layer.id) ? 0 : -1} className="layer-row" depth={depth} selected={item.id === layer.id} muted={!status.visible} onClick={() => setPicked(item.id)} onContextMenu={e => {if((e.target as HTMLElement).closest('input'))return;e.preventDefault();setPicked(item.id);e.currentTarget.focus();setMenu({id:item.id,x:e.clientX,y:e.clientY,target:e.currentTarget});}}  onKeyDown={e => {
          if(e.target !== e.currentTarget)return;
          if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(e.key==='ArrowDown'?1:-1)));setPicked(rows[next].item.id);tree.current?.querySelectorAll<HTMLElement>('[role="treeitem"]')[next]?.focus();}
          if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();toggle(item.id,e.key==='ArrowRight');}
          if(e.key==='Enter'){e.preventDefault();execute({type:'activeLayer',id:item.id},'Set active layer');}
          if(e.key==='F2'){e.preventDefault();setRenaming(item.id);}
          if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();setMenu({id:item.id,x:rect.left+24,y:rect.bottom,target:e.currentTarget});}
        }}>
          <button className="layer-chevron" aria-label={`${open ? 'Collapse' : 'Expand'} ${item.name}`} disabled={!nested} onClick={e => { e.stopPropagation(); toggle(item.id, !open); }}>{nested && (open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>)}</button>
          <span className="layer-swatch" style={{ background: item.color }}/><span className="layer-name" title="Double-click to rename · Right-click for layer actions" onDoubleClick={()=>setRenaming(item.id)}>{renaming===item.id?<InlineRename name={item.name} label="Layer name" onSave={name=>update({...item,name})} onClose={()=>setRenaming(null)}/>:item.name}</span><span className="layer-count">{counts.get(item.id) ?? 0}</span>
          <button className="layer-current" title={active?.id === item.id ? 'Active layer: new objects go here' : 'Make active layer'} aria-label={`Make ${item.name} active`} aria-pressed={active?.id === item.id} disabled={!status.visible || status.locked} onClick={e => { e.stopPropagation(); execute({ type: 'activeLayer', id: item.id }, 'Set active layer'); }}>{active?.id === item.id ? <Check size={13}/> : <span className="current-dot"/>}</button>
          <button title={!item.visible ? 'Hidden' : !status.visible ? 'Hidden by parent layer' : 'Visible'} aria-label={`${item.visible ? 'Hide' : 'Show'} layer ${item.name}`} onClick={e => { e.stopPropagation(); update({ ...item, visible: !item.visible }); }}>{status.visible ? <Eye size={14}/> : <EyeOff size={14}/>}</button>
          <button title={!item.locked && status.locked ? 'Locked by parent layer' : status.locked ? 'Locked' : 'Unlocked'} aria-label={`${item.locked ? 'Unlock' : 'Lock'} layer ${item.name}`} onClick={e => { e.stopPropagation(); update({ ...item, locked: !item.locked }); }}>{status.locked ? <LockKeyhole size={13}/> : <UnlockKeyhole size={13}/>}</button>
        </TreeRow>;
      })}
      {!rows.length && <p className="organizer-empty">No matching layers.</p>}
    </div>
    {menu&&project.layers.some(l=>l.id===menu.id)&&<LayerMenu anchor={menu} layer={project.layers.find(l=>l.id===menu.id)!} project={project} onClose={()=>setMenu(null)} onRename={()=>setRenaming(menu.id)} onSave={update} onDelete={()=>execute({type:'removeLayer',id:menu.id},'Delete empty layer')}/>}
    <div className="layer-actions"><button disabled={!canMove || !layerState(project, layer.id).visible || layerState(project, layer.id).locked} onClick={() => execute({ type:'assignLayer',ids:selectedIds,layerId:layer.id }, 'Move selection to ' + layer.name)}>Move selection here{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</button><div><button onClick={() => editor.isolateLayer(isolatedId === layer.id ? null : layer.id)}>{isolatedId === layer.id ? 'Restore view' : 'Isolate'}</button><button onClick={() => onSelectObjects(ids.filter(id => objectLayer(project, id) === layer.id && canEditObject(project, id, isolatedId)))}>Select objects</button></div></div>
    <Row className="layer-active-status"><span className="layer-swatch" style={{background:active?.color}}/><span>Drawing on <strong>{active?.name ?? 'no active layer'}</strong></span></Row>
  </Panel>;
}
