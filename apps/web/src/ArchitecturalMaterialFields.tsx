import {useEffect,useState} from 'react';
import {architecturalMaterials,architecturalMaterialUsers,architecturalMaterialSchema,architecturalMaterialTargets,type ArchitecturalMaterial,type Editor,type Project} from '@openlandcraft/core';
import {InspectorSection} from './InspectorSection';
import {Button,ColorInput,Field,FieldMessage,NumericInput,Row,SelectInput,SelectOption,TextInput} from './ui';

export function ArchitecturalMaterialFields({project,editor,ids}:{project:Project;editor:Editor;ids:string[]}){
 const parts=architecturalMaterialTargets(project,ids),state=editor.getSnapshot(),library=architecturalMaterials(project),common=parts[0]?.materialId??'color',mixed=parts.some(p=>(p.materialId??'color')!==common);
 const [chosen,setChosen]=useState(mixed?'mixed':common),[values,setValues]=useState({name:'',color:'#ffffff',scale:'1',roughness:'.8'}),[editingId,setEditingId]=useState<string|null>(null),[issue,setIssue]=useState('');
 const editing=!!editingId&&state.gestureLabel==='Edit shared architectural material',blocked=!!state.gestureLabel&&!editing,material=library.find(m=>m.id===chosen),users=architecturalMaterialUsers(project,chosen);
 useEffect(()=>{setChosen(mixed?'mixed':common);setIssue('');},[ids.join('|'),common,mixed]);
 useEffect(()=>{if(!state.gestureLabel)setEditingId(null);},[state.gestureLabel]);
 if(!parts.length)return null;
 const run=(action:()=>void)=>{try{action();setIssue('');}catch(error){setIssue(error instanceof Error?error.message:'Could not update material.');}};
 const begin=()=>{if(!material)return;editor.begin('Edit shared architectural material');setEditingId(material.id);setValues({name:material.name,color:material.color,scale:String(material.scale),roughness:String(material.roughness)});setIssue('');};
 const change=(next:typeof values)=>{setValues(next);run(()=>{const base=architecturalMaterials(editor.getSnapshot().project).find(m=>m.id===editingId)!;const candidate=architecturalMaterialSchema.safeParse({...base,name:next.name,color:next.color,scale:next.scale.trim()?Number(next.scale):NaN,roughness:next.roughness.trim()?Number(next.roughness):NaN});if(!candidate.success)throw new Error('Use a name, texture size 0.1–20 m and roughness 0.05–1.');editor.preview({type:'architecturalMaterial',material:candidate.data});});};
 return <InspectorSection sectionId="architectural-material" title="Material" className="mx-panel">
  <Field>Shared material<SelectInput aria-label="Architectural material" value={chosen} disabled={blocked||editing} onValueChange={id=>{setChosen(id);setIssue('');}}>
   {mixed&&<SelectOption value="mixed" disabled>Mixed materials</SelectOption>}<SelectOption value="color">Object color · no texture</SelectOption>{library.map(m=><SelectOption key={m.id} value={m.id}>{m.name}</SelectOption>)}
  </SelectInput></Field>
  <FieldMessage>{parts.length===1?'Applies to '+parts[0].name: 'Applies to '+parts.length+' architectural elements in this selection.'}</FieldMessage>
  <Button disabled={blocked||editing||chosen==='mixed'||(!mixed&&chosen===common)} onClick={()=>run(()=>editor.execute({type:'assignArchitecturalMaterial',ids:parts.map(p=>p.id),materialId:chosen==='color'?null:chosen},'Apply shared material'))}>Apply material</Button>
  {material&&<>
   <FieldMessage>{users.length} object{users.length===1?' uses':'s use'} this material. Texture size {material.scale} m per repeat.</FieldMessage>
   {!editing?<Row><Button variant="ghost" disabled={blocked} onClick={begin}>Edit shared material</Button><Button variant="ghost" disabled={blocked||!users.length||mixed||common!==chosen} onClick={()=>run(()=>{const unique:ArchitecturalMaterial={...material,id:crypto.randomUUID(),name:(material.name.slice(0,67)+' · unique').slice(0,80)};editor.execute({type:'batch',commands:[{type:'architecturalMaterial',material:unique},{type:'assignArchitecturalMaterial',ids:parts.map(p=>p.id),materialId:unique.id}]},'Make material unique');setChosen(unique.id);})}>Make unique</Button></Row>:<form onSubmit={e=>{e.preventDefault();if(!issue){editor.commit();setEditingId(null);}}}>
    <Field>Name<TextInput aria-label="Shared material name" value={values.name} maxLength={80} required onChange={e=>change({...values,name:e.target.value})}/></Field>
    <Field variant="color"><ColorInput aria-label="Shared material color" value={values.color} onChange={e=>change({...values,color:e.target.value})}/><span>Material color</span></Field>
    <Field>Texture size · metres per repeat<NumericInput aria-label="Material texture size" min={.1} max={20} step="any" required value={values.scale} onChange={e=>change({...values,scale:e.target.value})}/></Field>
    <Field>Roughness<NumericInput aria-label="Material roughness" min={.05} max={1} step="any" required value={values.roughness} onChange={e=>change({...values,roughness:e.target.value})}/></Field>
    <FieldMessage>Preview updates all {users.length} linked objects, including hidden ones. Larger texture size makes larger stones, boards or tiles. Apply keeps the shared change; Make unique creates an independent material for this selection.</FieldMessage>
    <Row><Button type="submit" disabled={!!issue}>Apply shared changes</Button><Button variant="ghost" onClick={()=>{editor.cancel();setEditingId(null);setIssue('');}}>Cancel material changes</Button></Row>
   </form>}
  </>}
  {!material&&!mixed&&<FieldMessage>Choose stone, timber or roof slate to add a shared textured finish. Object color keeps the original flat appearance.</FieldMessage>}
  {issue&&<FieldMessage role="alert" tone="error">{issue}</FieldMessage>}
 </InspectorSection>;
}
