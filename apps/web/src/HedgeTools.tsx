import {useEffect,useState} from 'react';
import {ZodError} from 'zod';
import {applyCommand,canEditObject,createHedge,groundHeight,mirrorOwner,type Editor,type Hedge,type Project} from '@openlandcraft/core';
import {pathLength,hedgeRoute,hedgeCornerAmounts,type PathPoint} from '@openlandcraft/landscape';
import {Button,CheckboxInput,ColorInput,Field,FieldGrid,FieldMessage,NumberField,Panel,PanelBody,PanelHeading,PointEditor,Row,SelectInput,SelectOption,TextInput} from './ui';
import {InspectorSection} from './InspectorSection';
const message=(e:unknown)=>e instanceof ZodError?e.issues[0]?.message??'Choose valid hedge dimensions.':(e as Error).message;
function HedgeFields({value,site,onChange}:{value:Hedge;site:Project['site'];onChange:(h:Hedge)=>void}){
 const change=(patch:Partial<Hedge>)=>onChange({...value,...patch});
 return <>
  <Field>Name<TextInput aria-label="Hedge name" value={value.name} maxLength={80} onChange={e=>change({name:e.target.value})}/></Field>
  <FieldGrid columns={2}><NumberField label="Hedge width" min={.3} max={4} value={value.width} unit="m" onChange={width=>change({width})}/>{value.topMode==='terrain'&&<NumberField label="Hedge height" min={.3} max={5} value={value.height} unit="m" onChange={height=>change({height})}/>}</FieldGrid>
  <Field>Clipped top<SelectInput aria-label="Hedge top mode" value={value.topMode} onValueChange={v=>change({topMode:v as Hedge['topMode'],topElevation:v==='level'?Math.max(...value.points.map(p=>groundHeight(...p,site)),2)+value.height:undefined})}><SelectOption value="terrain">Follow terrain · constant height</SelectOption><SelectOption value="level">Level top · fixed elevation</SelectOption></SelectInput></Field>
  {value.topMode==='level'&&<NumberField label="Hedge top elevation" min={-8} max={35} value={value.topElevation!} unit="m" onChange={topElevation=>change({topElevation})}/>}
  <Field variant="checkbox"><CheckboxInput aria-label="Closed hedge loop" checked={value.closed} onChange={e=>change({closed:e.target.checked,rounding:0,cornerRounding:hedgeCornerAmounts(value).map((v,i)=>!e.target.checked&&(i===0||i===value.points.length-1)?0:v)})}/>Closed loop / parterre</Field>

  <FieldMessage>{value.closed?'The last corner connects to the first; the center stays open.':''} Click a numbered anchor to round that corner with its slider. Drag anchors to move them. Level tops must remain 0.3–5 m above the ground. Roots follow terrain without grading it.</FieldMessage>
  <Field variant="color"><ColorInput aria-label="Hedge foliage color" value={value.color} onChange={e=>change({color:e.target.value})}/><span>Foliage color</span></Field>
  <FieldGrid columns={2}><NumberField label="Hedge leaf size" min={.04} max={.3} value={value.leafSize} unit="m" onChange={leafSize=>change({leafSize})}/><NumberField label="Hedge roughness" min={.5} max={1} value={value.roughness} unit="" onChange={roughness=>change({roughness})}/></FieldGrid>
 </>;
}
export function useHedgeTool(editor:Editor,snapping:boolean,onSnapping:(v:boolean)=>void,onFinish:(id?:string)=>void,onError:(s:string)=>void){
 const [cornerIndex,setCornerIndex]=useState<number|null>(null);
 const [settings,setSettings]=useState(()=>createHedge(editor.getSnapshot().project)),[points,setPoints]=useState<PathPoint[]>([]),[redrawId,setRedrawId]=useState<string|undefined>();
 const project=editor.getSnapshot().project,draft={...settings,points};
 const start=(id?:string)=>{const existing=project.entities.find(e=>e.id===id);if(id&&(existing?.kind!=='hedge'||!canEditObject(project,id,editor.getSnapshot().isolatedLayerId)))throw new Error('Show and unlock this hedge before redrawing.');if(id&&mirrorOwner(project,id))throw new Error('Detach the mirrored hedge before redrawing it.');setSettings(existing?.kind==='hedge'?{...existing,rounding:0,cornerRounding:undefined}:createHedge(project));setRedrawId(id);setPoints([]);setCornerIndex(null);};
 let error='';if(points.length>=2)try{applyCommand(project,{type:redrawId?'replace':'add',entity:draft});}catch(e){error=message(e);}
 const point=(x:number,z:number)=>{if(points.length>=16){onError('Finish the hedge with up to 16 control points.');return;}const p:PathPoint=snapping?[Math.round(x*2)/2,Math.round(z*2)/2]:[x,z];if(points.length&&Math.hypot(p[0]-points.at(-1)![0],p[1]-points.at(-1)![1])<1){onError('Keep adjacent hedge points at least 1 m apart.');return;}setSettings(old=>({...old,cornerRounding:old.cornerRounding?[...old.cornerRounding,0]:undefined}));setPoints([...points,p]);setCornerIndex(null);onError('');};
 const panel=<Panel padding="body"><PanelHeading title={redrawId?'Redraw clipped hedge':'Draw clipped hedge'} subtitle="CONTINUOUS TRIMMED FOLIAGE"/><HedgeFields value={draft} site={project.site} onChange={setSettings}/>
  <Field variant="checkbox"><CheckboxInput aria-label="Snap hedge drawing" checked={snapping} onChange={e=>onSnapping(e.target.checked)}/>Snap points to 0.5 m</Field>
  <FieldMessage>{points.length?`${points.length} / 16 points · ${points.length>=2?pathLength(hedgeRoute(draft)).toFixed(1):'0'} m. Click another corner or finish.`:'Click the hedge start on the terrain, then its corners and end.'}</FieldMessage>
  {error&&<FieldMessage tone="error" role="alert">{error}</FieldMessage>}
  <Row><Button type="button" disabled={points.length<2||!!error} onClick={()=>{try{editor.execute({type:redrawId?'replace':'add',entity:draft},redrawId?'Redraw hedge':'Add clipped hedge');onFinish(draft.id);}catch(e){onError(message(e));}}}>Finish hedge</Button><Button type="button" variant="ghost" disabled={!points.length} onClick={()=>{setPoints(p=>p.slice(0,-1));setSettings(old=>({...old,cornerRounding:old.cornerRounding?.slice(0,-1).map((v,i,a)=>!old.closed&&(i===0||i===a.length-1)?0:v)}));setCornerIndex(null);}}>Back</Button><Button type="button" variant="ghost" onClick={()=>onFinish()}>Cancel</Button></Row>
 </Panel>;
 return {start,point,panel,draft,cornerIndex,setCornerIndex,roundCorner:(amount:number)=>{if(cornerIndex===null)return;const cornerRounding=[...hedgeCornerAmounts(draft)];cornerRounding[cornerIndex]=amount;setSettings(old=>({...old,cornerRounding}));},reset:()=>{setPoints([]);setCornerIndex(null);}};
}
export function HedgeInspector({hedge,editor,cancel,snapping,onSnapping,onRedraw,onCorner}:{onCorner:(i:number)=>void;hedge:Hedge;editor:Editor;cancel:()=>void;snapping:boolean;onSnapping:(v:boolean)=>void;onRedraw:()=>void}){
 const [draft,setDraft]=useState(hedge),[error,setError]=useState('');useEffect(()=>setDraft(hedge),[hedge]);const state=editor.getSnapshot();
 const change=(next:Hedge)=>{setDraft(next);if(!editor.getSnapshot().gestureLabel)editor.begin('Edit clipped hedge');try{editor.preview({type:'replace',entity:next});setError('');}catch(e){setError(message(e));}};
 return <PanelBody><PanelHeading title={hedge.name} subtitle={`${pathLength(hedgeRoute(draft)).toFixed(1)} m · Clipped hedge${draft.closed?' loop':''}`}/>
  <FieldMessage>Click a numbered anchor to open its rounding slider; drag it to move the corner. Width, height and foliage remain one editable object. Plants regenerate clear of hedge roots; walking routes treat the hedge as a barrier.</FieldMessage>
  <Button type="button" variant="outline" disabled={!!state.gestureLabel} onClick={onRedraw}>Redraw hedge</Button>
  <Field variant="checkbox"><CheckboxInput aria-label="Snap hedge points" checked={snapping} onChange={e=>onSnapping(e.target.checked)}/>Snap hedge points to 0.5 m</Field>
  <HedgeFields value={draft} site={state.project.site} onChange={change}/>
  <InspectorSection sectionId="hedge-control-points" title="Hedge control points" defaultOpen={false}>
   {draft.points.map((p,i)=><PointEditor key={i} title={`Point ${i+1}`} actions={<>{(draft.closed||i>0&&i<draft.points.length-1)&&<Button type="button" variant="ghost" disabled={!!state.gestureLabel} onClick={()=>onCorner(i)}>Round corner</Button>}<Button type="button" variant="ghost" disabled={draft.points.length>=16||!draft.closed&&i===draft.points.length-1} aria-label={`Insert after hedge point ${i+1}`} onClick={()=>{const points=structuredClone(draft.points),q=points[(i+1)%points.length],cornerRounding=[...hedgeCornerAmounts(draft)];points.splice(i+1,0,[(p[0]+q[0])/2,(p[1]+q[1])/2]);cornerRounding.splice(i+1,0,0);change({...draft,points,cornerRounding});}}>+</Button><Button type="button" variant="ghost" disabled={draft.points.length<=(draft.closed?3:2)} aria-label={`Remove hedge point ${i+1}`} onClick={()=>change({...draft,points:draft.points.filter((_,j)=>i!==j),cornerRounding:hedgeCornerAmounts(draft).filter((_,j)=>i!==j).map((v,k,a)=>!draft.closed&&(k===0||k===a.length-1)?0:v)})}>−</Button></>}><FieldGrid columns={2}>{p.map((v,axis)=><NumberField key={axis} label={`Hedge point ${i+1} ${axis===0?'X':'Z'}`} value={v} min={-100} max={100} onChange={n=>{const points=structuredClone(draft.points);points[i][axis]=n;change({...draft,points});}}/>)}</FieldGrid></PointEditor>)}
  </InspectorSection>
  {error&&<FieldMessage tone="error" role="alert">{error}</FieldMessage>}
  <Row><Button type="button" disabled={!state.gestureLabel||!!error} onClick={()=>editor.commit()}>Apply hedge changes</Button><Button type="button" variant="ghost" disabled={!state.gestureLabel} onClick={cancel}>Cancel preview</Button></Row>
  <Button type="button" variant="destructive" disabled={!!state.gestureLabel} onClick={()=>editor.execute({type:'remove',id:hedge.id},'Delete hedge')}>Delete hedge</Button>
 </PanelBody>;
}
