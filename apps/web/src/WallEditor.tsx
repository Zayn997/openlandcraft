import { Button, CheckboxInput, ColorInput, Field, FieldControl, FieldGrid, FieldMessage, NumericInput, Row, TextInput } from './ui';
import { useEffect, useState } from 'react';
import { applyCommand, type Editor, type Level, type Wall } from '@openlandcraft/core';
import { InspectorSection } from './InspectorSection';
import { CurvedWallEditor } from './CurvedWallEditor';
import { WallPropertiesPanel } from './WallPropertiesPanel';

export function WallEditor(props:Parameters<typeof StraightWallEditor>[0]){
  return props.wall.curve?<CurvedWallEditor {...props}/>:<StraightWallEditor {...props}/>;
}
function StraightWallEditor(props: {
  wall: Wall; level?: Level; editing: boolean; editor: Editor; snapping: boolean; onSnapping: (value: boolean) => void;
  onFrame: () => void; onEdit?: () => void; onFinish: () => void; onSelect: (id: string) => void; status: string; onStatus: (message: string) => void;
}) {
  const {wall,editor,onStatus}=props;
  const fields = ['startX', 'startZ', 'endX', 'endZ', 'height', 'thickness', 'elevation'] as const;
  type Field = typeof fields[number];
  const labels: Record<Field, string> = { startX: 'Start X', startZ: 'Start Z', endX: 'End X', endZ: 'End Z', height: 'Wall height', thickness: 'Wall thickness', elevation: 'Base elevation' };
  const valuesFor = (value: Wall) => ({ startX: value.start[0], startZ: value.start[1], endX: value.end[0], endZ: value.end[1], height: value.height, thickness: value.thickness, elevation: value.elevation });
  const [values, setValues] = useState<Record<Field, string>>(() => Object.fromEntries(Object.entries(valuesFor(wall)).map(([k, v]) => [k, String(v)])) as Record<Field, string>);
  useEffect(() => { setValues(Object.fromEntries(Object.entries(valuesFor(wall)).map(([k, v]) => [k, String(Number(v.toFixed(8)))])) as Record<Field, string>); }, [wall]);
  const [name, setName] = useState(wall.name), [color, setColor] = useState(wall.color), [joins, setJoins] = useState(wall.joins);
  useEffect(() => { setName(wall.name); setColor(wall.color); setJoins(wall.joins); }, [wall]);
  const dx=Number(values.endX)-Number(values.startX), dz=Number(values.endZ)-Number(values.startZ), length=Math.hypot(dx,dz);
  const setDirection=(x:number,z:number)=>setValues(old=>({...old,endX:String(Number((Number(old.startX)+x).toFixed(8))),endZ:String(Number((Number(old.startZ)+z).toFixed(8)))}));
  const state = editor.getSnapshot();
  let candidate: Wall | undefined, issue = '';
  const changed = name!==wall.name || color!==wall.color || joins!==wall.joins || fields.some(key => Math.abs(Number(values[key]) - valuesFor(wall)[key]) > 1e-8 || values[key].trim() === '');
  if (changed && !state.gestureLabel) try {
    const n = (key: Field) => values[key].trim() === '' ? NaN : Number(values[key]);
    candidate = { ...wall, name, color, joins, start: [n('startX'), n('startZ')], end: [n('endX'), n('endZ')], height: n('height'), thickness: n('thickness'), elevation: n('elevation') };
    applyCommand(state.project, { type: 'replace', entity: candidate });
  } catch (error) { issue = error instanceof Error ? error.message : 'Invalid wall dimensions.'; }
  const numericField=(key:Field)=><Field variant="number" key={key}><span>{labels[key]}</span><FieldControl><NumericInput aria-label={labels[key]} step="any" required value={values[key]} onChange={e => setValues(old => ({ ...old, [key]: e.target.value }))} /><small>m</small></FieldControl></Field>;
  return <WallPropertiesPanel {...props}>
      <form onSubmit={event => { event.preventDefault(); if (candidate && !issue && changed && !state.gestureLabel) try { editor.execute({ type: 'replace', entity: candidate }, 'Edit wall dimensions'); onStatus('Wall dimensions applied.'); } catch (error) { onStatus(error instanceof Error ? error.message : 'Invalid wall edit.'); } }}>
        <fieldset className="opening-edit-fields" disabled={!!state.gestureLabel}>
        <Field>Name<TextInput aria-label="Wall name" value={name} maxLength={80} required onChange={e => setName(e.target.value)} /></Field>
        <FieldGrid columns={2}>
        {(['height','thickness','elevation'] as const).map(numericField)}
        <Field variant="number"><span>Wall length</span><FieldControl><NumericInput aria-label="Wall length" min="0.2" max="200" step="any" value={Number.isFinite(length)?Number(length.toFixed(8)):''} onChange={e=>{const value=Number(e.target.value);if(length>0&&Number.isFinite(value))setDirection(dx*value/length,dz*value/length);}}/><small>m</small></FieldControl></Field>
        </FieldGrid>
        <Field variant="checkbox" title="Height and base elevation apply to connected walls; thickness stays independent."><CheckboxInput checked={!!joins} onChange={e => setJoins(e.target.checked)} />Join wall chain</Field>
        <Field variant="color"><ColorInput aria-label="Wall color" disabled={!!wall.materialId} title={wall.materialId?'Color comes from the shared Material section':undefined} value={color} onChange={e => setColor(e.target.value)} /><span>Wall color</span></Field>
        <InspectorSection sectionId="wall-position" title="Position" defaultOpen={false}>
          <FieldGrid columns={2}>{(['startX','startZ','endX','endZ'] as const).map(numericField)}</FieldGrid>
          <Row><Button variant="secondary" onClick={()=>setDirection((Math.sign(dx)||Math.sign(dz)||1)*length,0)}>Align X</Button><Button variant="secondary" onClick={()=>setDirection(0,(Math.sign(dz)||Math.sign(dx)||1)*length)}>Align Z</Button></Row>
        </InspectorSection>
        {issue && <FieldMessage tone="error" role="alert">{issue}</FieldMessage>}
        <Button type="submit" disabled={!changed || !!issue}>Apply changes</Button></fieldset>
      </form>
  </WallPropertiesPanel>;
}
