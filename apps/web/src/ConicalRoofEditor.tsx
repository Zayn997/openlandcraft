import {useEffect,useState} from 'react';
import {applyCommand,isCircularWall,setConicalRoofTower,unitForPart,updateConicalRoof,type Roof,type Wall} from '@openlandcraft/core';
import type {OutlineEditor} from './OutlineEditor';
import {Button,CheckboxInput,ColorInput,Field,FieldControl,FieldGrid,FieldMessage,NumericInput,Panel,PanelHeading,SelectInput,SelectOption,TextInput} from './ui';

export function ConicalRoofEditor({part,level,editing,editor,snapping,onSnapping,onFrame,onFinish,onSelect,status,onStatus}:Parameters<typeof OutlineEditor>[0]){
  const roof=part as Roof,cone=roof.cone!,state=editor.getSnapshot(),busy=!!state.gestureLabel,unit=unitForPart(state.project,roof.id);
  const valuesFor=()=>({radius:cone.radius,height:roof.rise,overhang:cone.overhang,elevation:roof.elevation,centerX:roof.center[0],centerZ:roof.center[1]});
  type Key=keyof ReturnType<typeof valuesFor>;
  const textValues=()=>Object.fromEntries(Object.entries(valuesFor()).map(([key,value])=>[key,String(Number(value.toFixed(8)))])) as Record<Key,string>;
  const [values,setValues]=useState(textValues),[name,setName]=useState(roof.name),[color,setColor]=useState(roof.color),[towerId,setTowerId]=useState(cone.wallId??'independent');
  useEffect(()=>{setValues(textValues());setName(roof.name);setColor(roof.color);setTowerId(cone.wallId??'independent');},[roof,editing]);
  const towers=state.project.entities.filter((e):e is Wall=>e.kind==='wall'&&e.parentId===roof.parentId&&isCircularWall(e));
  const linked=towerId!=='independent',tower=towers.find(w=>w.id===towerId),controlled=(key:Key)=>linked&&key!=='height'&&key!=='overhang';
  const changed=towerId!==(cone.wallId??'independent')||name!==roof.name||color!==roof.color||(Object.keys(values) as Key[]).some(key=>!controlled(key)&&(!values[key].trim()||Math.abs(Number(values[key])-valuesFor()[key])>1e-8));
  let candidate:Roof|undefined,issue='';
  if(editing&&changed&&!busy)try{
    const n=(key:Key)=>values[key].trim()?Number(values[key]):NaN;
    if(linked&&!tower)throw new Error('Choose an existing circular tower on this level.');
    const source=towerId!==(cone.wallId??'independent')?setConicalRoofTower(roof,tower??null):roof;
    candidate={...updateConicalRoof(source,{rise:n('height'),overhang:n('overhang'),...(!linked?{radius:n('radius'),elevation:n('elevation'),center:[n('centerX'),n('centerZ')] as [number,number]}:{})}),name,color};applyCommand(state.project,{type:'replace',entity:candidate});
  }catch(error){issue=error instanceof Error?error.message:'Invalid roof dimensions.';}
  const shown=(key:Key)=>controlled(key)&&tower?String(Number(({radius:tower.curve!.radius+tower.thickness/2,elevation:tower.elevation+tower.height,centerX:tower.curve!.center[0],centerZ:tower.curve!.center[1]} as Partial<Record<Key,number>>)[key]!.toFixed(8))):values[key];
  const labels:Record<Key,string>={radius:'Roof radius',height:'Roof height',overhang:'Roof overhang',elevation:'Eaves elevation',centerX:'Center X',centerZ:'Center Z'};
  return <Panel padding="body" aria-label={editing?'Edit conical roof':'Selected conical roof'}>
    <PanelHeading title={editing?'Editing conical roof':'Conical roof selected'} subtitle={level?.name}/>
    <p role="status">{editing?status:'Double-click this roof or press Enter to edit radius, height and overhang.'}</p>
    {!editing&&<dl className="opening-summary"><dt>Radius</dt><dd>{cone.radius.toFixed(2)} m</dd><dt>Height</dt><dd>{roof.rise.toFixed(2)} m</dd><dt>Overhang</dt><dd>{cone.overhang.toFixed(2)} m</dd></dl>}
    {!editing&&cone.wallId&&<FieldMessage>Following {towers.find(w=>w.id===cone.wallId)?.name??'tower'} · roof height and overhang remain editable.</FieldMessage>}
    <Button variant="ghost" onClick={onFrame}>Frame selected roof · F</Button>
    {editing&&<>
      <FieldMessage>{linked?'The tower controls radius, center and eaves elevation. Edit Height and Overhang here or with their handles.':'Drag the roof to move it. Radius and Overhang handles resize it; drag Height in 3D or use the fields below.'}</FieldMessage>
      <Field variant="checkbox"><CheckboxInput checked={snapping} disabled={busy} onChange={e=>onSnapping(e.target.checked)}/>Snap roof edits to 0.25 m</Field>
      <form onSubmit={e=>{e.preventDefault();if(candidate&&!issue&&changed)try{editor.execute({type:'replace',entity:candidate},'Edit conical roof');onStatus('Conical roof dimensions applied.');}catch(error){onStatus(error instanceof Error?error.message:'Could not edit roof.');}}}>
        <fieldset className="opening-edit-fields" disabled={busy}>
          <Field>Name<TextInput aria-label="Roof name" value={name} required maxLength={80} onChange={e=>setName(e.target.value)}/></Field>
          <Field>Follow tower<SelectInput aria-label="Follow tower" value={towerId} onValueChange={setTowerId}><SelectOption value="independent">Independent roof</SelectOption>{towers.map(w=><SelectOption key={w.id} value={w.id}>{w.name}</SelectOption>)}</SelectInput></Field>
          <FieldGrid columns="auto">{(Object.keys(labels) as Key[]).map(key=><Field variant="number" key={key}><span>{labels[key]}</span><FieldControl><NumericInput aria-label={labels[key]} step="any" required disabled={controlled(key)} value={shown(key)} onChange={e=>setValues(old=>({...old,[key]:e.target.value}))}/><small>m</small></FieldControl></Field>)}</FieldGrid>
          <Field variant="color"><ColorInput aria-label="Roof color" disabled={!!part.materialId} title={part.materialId?'Color comes from the shared Material section':undefined} value={color} onChange={e=>setColor(e.target.value)}/><span>Roof color</span></Field>
          {issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}
          <Button type="submit" disabled={!changed||!!issue}>Apply roof dimensions</Button>
        </fieldset>
      </form>
      <FieldMessage>Radius reaches the wall's outer face. Overhang extends beyond it; height runs from eaves to apex. A linked roof follows wall radius, thickness, center, height and base edits. Choose Independent roof to detach at its current size and position.</FieldMessage>
      <Button variant="ghost" disabled={busy} onClick={()=>{try{editor.execute({type:'remove',id:roof.id},'Delete conical roof');onFinish();}catch(error){onStatus(error instanceof Error?error.message:'Cannot delete roof.');}}}>Delete roof</Button>
      <Button onClick={onFinish}>Finish editing <span>Esc</span></Button>
    </>}
    {level&&<Button variant="ghost" onClick={()=>onSelect(level.id)}>Select whole floor · {level.name}</Button>}
    {unit&&<Button variant="ghost" onClick={()=>onSelect(unit.id)}>Select whole unit · {unit.name}</Button>}
  </Panel>;
}
