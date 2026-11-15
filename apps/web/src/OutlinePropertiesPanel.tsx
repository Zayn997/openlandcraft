import type { ReactNode } from 'react';
import { unitForPart } from '@openlandcraft/core';
import type { OutlineEditor } from './OutlineEditor';
import { PropertiesPanel } from './PropertiesPanel';
import { ArchitecturalMaterialFields } from './ArchitecturalMaterialFields';
import { Button, CheckboxInput, Field } from './ui';

export function OutlinePropertiesPanel({children,title,part,level,editor,editing,onEdit,onFinish,onFrame,onSelect,snapping,onSnapping,status,onStatus}:Parameters<typeof OutlineEditor>[0] & {title:string;children:ReactNode}) {
  const state=editor.getSnapshot(),busy=!!state.gestureLabel,unit=unitForPart(state.project,part.id);
  return <PropertiesPanel title={title} onFrame={onFrame} aria-label={`${title} properties`} status={status&&!/^(Drag |Double-click|Click |Selected )/.test(status)?status:undefined} actions={<>
    {!editing&&onEdit&&<Button variant="secondary" disabled={busy} onClick={onEdit}>Edit shape in viewport</Button>}
    {editing&&<><Field variant="checkbox"><CheckboxInput checked={snapping} disabled={busy} onChange={e=>onSnapping(e.target.checked)}/>Snap edits to 0.25 m</Field><Button variant="secondary" disabled={busy} onClick={onFinish}>Finish shape editing</Button></>}
    {level&&<Button variant="ghost" onClick={()=>onSelect(level.id)}>Select floor · {level.name}</Button>}
    {unit&&<Button variant="ghost" onClick={()=>onSelect(unit.id)}>Select unit · {unit.name}</Button>}
    <Button variant="destructive" disabled={busy} onClick={()=>{try{editor.execute({type:'remove',id:part.id},`Delete ${title.toLowerCase()}`);onFinish();}catch(e){onStatus(e instanceof Error?e.message:'Could not delete element.');}}}>Delete {title.toLowerCase()}</Button>
  </>}>
    {children}
    <ArchitecturalMaterialFields compact project={state.project} editor={editor} ids={[part.id]}/>
  </PropertiesPanel>;
}
