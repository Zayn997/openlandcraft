import type { ReactNode } from 'react';
import { PropertiesPanel } from './PropertiesPanel';
import { isCircularWall, unitForPart } from '@openlandcraft/core';
import type { WallEditor } from './WallEditor';
import { ArchitecturalMaterialFields } from './ArchitecturalMaterialFields';
import { BattlementsEditor } from './BattlementsEditor';
import { WallWalkEditor } from './WallWalkEditor';
import { Button, CheckboxInput, Field } from './ui';

/** Selection and shape-edit mode share the same property form. */
export function WallPropertiesPanel({ children, wall, level, editing, editor, snapping, onSnapping, onFrame, onEdit, onFinish, onSelect, status, onStatus }: Parameters<typeof WallEditor>[0] & { children: ReactNode }) {
  const state=editor.getSnapshot(), busy=!!state.gestureLabel, unit=unitForPart(state.project,wall.id);
  return <PropertiesPanel title={wall.curve ? isCircularWall(wall) ? 'Circular wall' : 'Arc wall' : 'Wall'} onFrame={onFrame} aria-label="Wall properties" actions={<>
        {onEdit && !editing && <Button variant="secondary" disabled={busy} onClick={onEdit}>Edit shape in viewport</Button>}
        {editing && <>
          <Field variant="checkbox"><CheckboxInput checked={snapping} disabled={busy} onChange={event=>onSnapping(event.target.checked)}/>Snap endpoints and 0.25 m grid</Field>
          <Button variant="secondary" disabled={busy} onClick={onFinish}>Finish shape editing</Button>
        </>}
        {level && <Button variant="ghost" className="whitespace-normal" onClick={()=>onSelect(level.id)}>Select floor · {level.name}</Button>}
        {unit && <Button variant="ghost" className="whitespace-normal" onClick={()=>onSelect(unit.id)}>Select unit · {unit.name}</Button>}
        <Button variant="destructive" disabled={busy} onClick={()=>{try{editor.execute({type:'remove',id:wall.id},'Delete wall');onFinish();}catch(error){onStatus(error instanceof Error?error.message:'Cannot delete wall.');}}}>Delete wall and openings</Button>
       </>} status={status&&!status.startsWith('Drag ')?status:undefined}>
    {children}
    <ArchitecturalMaterialFields project={state.project} editor={editor} ids={[wall.id]} compact/>
    <WallWalkEditor wall={wall} editor={editor} onStatus={onStatus}/>
    <BattlementsEditor wall={wall} editor={editor} onStatus={onStatus}/>

  </PropertiesPanel>;
}
