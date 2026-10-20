import type { Layer, Project } from '@openlandcraft/core';
import { useRef } from 'react';
import { objectLayer } from '@openlandcraft/core';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { ColorInput, Field, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from './ui';

export type LayerMenuAnchor={id:string;x:number;y:number;target:HTMLElement};
export function LayerMenu({anchor,layer,project,onClose,onRename,onSave,onDelete}:{anchor:LayerMenuAnchor;layer:Layer;project:Project;onClose:()=>void;onRename:()=>void;onSave:(layer:Layer)=>unknown;onDelete:()=>unknown}) {
  const renaming=useRef(false);
  const descendants=(id:string):boolean=>id===layer.id||!!project.layers.find(l=>l.id===id)?.parentId&&descendants(project.layers.find(l=>l.id===id)!.parentId!);
  const occupied=['terrain',...project.entities.map(e=>e.id)].some(id=>objectLayer(project,id)===layer.id)||project.layers.some(l=>l.parentId===layer.id);
  return <DropdownMenu open onOpenChange={open=>{if(!open)onClose();}} modal={false}>
    <DropdownMenuTrigger aria-hidden tabIndex={-1} style={{position:'fixed',left:anchor.x,top:anchor.y,width:0,height:0,minHeight:0,padding:0,border:0,pointerEvents:'none'}}/>
    <DropdownMenuContent aria-label="Layer actions" align="start" sideOffset={2} onCloseAutoFocus={e=>{e.preventDefault();if(!renaming.current){const row=document.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(layer.id)}"]`);(row??anchor.target).focus();}}}>
      <DropdownMenuLabel>{layer.name}</DropdownMenuLabel>
      <DropdownMenuItem onSelect={()=>{renaming.current=true;onClose();onRename();}}><Pencil/>Rename<span className="ml-auto text-muted">F2</span></DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={layer.id==='default'}>Parent layer</DropdownMenuSubTrigger>
        <DropdownMenuSubContent aria-label="Parent layer">
          <DropdownMenuItem onSelect={()=>onSave({...layer,parentId:null})}>{layer.parentId===null&&<Check/>}None</DropdownMenuItem>
          {project.layers.filter(l=>!descendants(l.id)).map(parent=><DropdownMenuItem key={parent.id} onSelect={()=>onSave({...layer,parentId:parent.id})}>{layer.parentId===parent.id&&<Check/>}{parent.name}</DropdownMenuItem>)}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger><span className="layer-swatch" style={{background:layer.color}}/>Color</DropdownMenuSubTrigger>
        <DropdownMenuSubContent aria-label="Layer color" className="p-3" onKeyDown={e=>{if(e.target instanceof HTMLInputElement&&e.key!=='Escape')e.stopPropagation();}}>
          <Field>Layer color<ColorInput aria-label="Layer color" value={layer.color} onChange={e=>onSave({...layer,color:e.target.value})}/></Field>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator/>
      <DropdownMenuItem variant="destructive" disabled={layer.id==='default'||occupied} onSelect={onDelete}><Trash2/>Delete empty layer</DropdownMenuItem>
      {occupied&&<DropdownMenuLabel>Move objects and sublayers before deleting.</DropdownMenuLabel>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
