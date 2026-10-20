import { Button, Panel, PointEditor, ActionBar, ActionRow, CheckboxInput, ColorInput, Field, FieldGrid, FieldMessage, NumberField, PanelBody, PanelHeading, SelectInput, SelectOption, TextInput } from './ui';
import { InspectorSection } from './InspectorSection';
import {useState,type ReactNode} from 'react';
import {Check,Leaf,Plus,RotateCcw,Trash2} from 'lucide-react';
import {REGION_SURFACES,isRegion,type Editor,type Region,type PlantingRegion} from '@openlandcraft/core';
import {polygonArea,type PathPoint} from '@openlandcraft/landscape';

export type RegionTool='material'|'planting';
export function RegionTools({type,onType,editor,onSelect,onDraw,onAdd,drawing,children}:{type:RegionTool;onType:(type:RegionTool)=>void;editor:Editor;onSelect:(id:string)=>void;onDraw:()=>void;onAdd:()=>void;drawing:boolean;children?:ReactNode}){
  const regions=editor.getSnapshot().project.entities.filter(isRegion),full=regions.length>=8,needsModel=type==='planting'&&!editor.getSnapshot().project.assets.length;
  return <Panel className="region-panel"><PanelHeading icon={<Leaf size={18}/>} title={<>Landscape regions</>} subtitle={<>Surface and planting areas</>} />
    <div className="water-type-tabs" role="tablist" aria-label="Region type">{(['material','planting'] as const).map(value=><button key={value} id={`region-type-${value}`} role="tab" aria-selected={type===value} aria-controls="region-type-panel" tabIndex={type===value?0:-1} onClick={()=>onType(value)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'material':e.key==='End'?'planting':type==='material'?'planting':'material';onType(next);(e.currentTarget.parentElement?.querySelector(`#region-type-${next}`) as HTMLButtonElement|null)?.focus();}}>{value==='material'?'Surface':'Planting'}</button>)}</div>
    <div id="region-type-panel" role="tabpanel" aria-labelledby={`region-type-${type}`}>
      {children??<div className="water-create"><h3>{type==='material'?'Define a ground surface':'Grow a planting area'}</h3><p>{type==='material'?'Draw an area of grass, sand, rock, or gravel. It follows the terrain without changing its heights.':'Draw an area, choose a model, and preview seeded planting around your water, paths, and buildings.'}</p>
        <Button variant="default" className="primary-button" disabled={drawing||full||needsModel} onClick={onDraw}>{drawing?'Drawing in viewport…':`Draw ${type==='material'?'surface':'planting'} region`}</Button><button className="water-starter" disabled={drawing||full||needsModel} onClick={onAdd}><Plus size={15}/>Add starter region</button>
        {needsModel&&<p role="status">Add a Demo tree or import a model first.</p>}{full&&<p role="status">Eight regions reached. Edit or remove an existing region.</p>}
        <FieldMessage>{drawing?'Click at least three boundary points, then Finish region.':'Up to eight regions. Preview changes before applying.'}</FieldMessage>
        {regions.filter(r=>r.kind===(type==='material'?'materialRegion':'plantingRegion')).map(r=><button key={r.id} className="part-link" onClick={()=>onSelect(r.id)}>{r.name}<span>Edit</span></button>)}
      </div>}
    </div>
  </Panel>;
}
export function RegionInspector({region,editor,cancel,snapping,onSnapping}:{region:Region;editor:Editor;cancel:()=>void;snapping:boolean;onSnapping:(v:boolean)=>void}){
  const [draft,setDraft]=useState(region),[error,setError]=useState(''),[pending,setPending]=useState(false),[previewed,setPreviewed]=useState(false);
  const state=editor.getSnapshot(),plant=draft.kind==='plantingRegion',area=polygonArea(draft.points);
  const count=(state.preview??state.project).entities.filter(e=>e.kind==='instance'&&e.regionId===region.id).length;
  const change=(next:Region)=>{
    setDraft(next);setError('');setPending(true);setPreviewed(false);
    if(next.kind==='plantingRegion'){editor.cancel();return;}
    if(!editor.getSnapshot().gestureLabel)editor.begin('Edit surface region');
    try{editor.preview({type:'replace',entity:next});setPreviewed(true);}catch(e){setError(e instanceof Error?e.message:'Invalid region.');}
  };
  const preview=()=>{if(draft.kind!=='plantingRegion')return;editor.cancel();try{editor.begin('Regenerate planting');editor.preview({type:'planting',region:draft});setPreviewed(true);setPending(true);setError('');}catch(e){editor.cancel();setPreviewed(false);setError(e instanceof Error?e.message:'Planting preview failed.');}};
  const plantNumber=(key:'seed'|'density'|'scaleMin'|'scaleMax'|'spacing'|'clearance',label:string,min:number,max:number,unit='')=>draft.kind==='plantingRegion'&&<NumberField label={label} value={draft[key]} min={min} max={max} unit={unit} onChange={value=>change({...draft,[key]:value})}/>;
  return <PanelBody className="region-inspector"><PanelHeading title={<>{region.name}</>} subtitle={<>{area.toFixed(1)} m² · {plant?`${count} generated plants`:'Follows terrain'}</>} />
    {!plant&&<Field variant="checkbox"><CheckboxInput aria-label="Snap region points" checked={snapping} onChange={e=>onSnapping(e.target.checked)}/>Snap boundary points to 0.5 m</Field>}
    <form onSubmit={e=>{e.preventDefault();if(previewed&&!error)editor.commit();}}>
      <InspectorSection sectionId="regioninspector-region-settings" title={<>{plant?'Planting settings':'Surface material'}</>}><Field>Name<TextInput aria-label="Region name" value={draft.name} required maxLength={80} onChange={e=>change({...draft,name:e.target.value})}/></Field>
        {draft.kind==='materialRegion'?<>
          <Field>Surface<SelectInput aria-label="Region surface" value={draft.surface} onValueChange={(value) =>{const surface=value as keyof typeof REGION_SURFACES;change({...draft,surface,...REGION_SURFACES[surface]});}}>{Object.keys(REGION_SURFACES).map(s=><SelectOption key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</SelectOption>)}</SelectInput></Field>
          <Field variant="color"><ColorInput aria-label="Region color" value={draft.color} onChange={e=>change({...draft,color:e.target.value})}/><span>Surface color</span><code>{draft.color.toUpperCase()}</code></Field>
          <FieldGrid columns={2}><NumberField label="Region detail size" value={draft.detailScale} min={0.25} max={4} unit="×" onChange={detailScale=>change({...draft,detailScale})}/><NumberField label="Region roughness" value={draft.roughness} min={0.3} max={1} unit="" onChange={roughness=>change({...draft,roughness})}/></FieldGrid><FieldMessage>Later-created surface regions cover earlier ones. Paths remain above these surfaces. Terrain heights stay unchanged.</FieldMessage>
        </>:<>
          <Field>Model source<SelectInput aria-label="Planting source" value={draft.assetId} onValueChange={(value) =>change({...draft,assetId:value})}>{state.project.assets.map(a=><SelectOption key={a.id} value={a.id}>{a.name}</SelectOption>)}</SelectInput></Field>
          <FieldGrid columns={2}>{plantNumber('seed','Planting seed',0,2147483647)}{plantNumber('density','Plants per 100 m²',1,100)}{plantNumber('scaleMin','Minimum scale',0.05,5,'×')}{plantNumber('scaleMax','Maximum scale',0.05,5,'×')}{plantNumber('spacing','Minimum spacing',0.5,15,'m')}{plantNumber('clearance','Obstacle clearance',0,10,'m')}</FieldGrid>
          <FieldMessage>Density requests {Math.floor(area*draft.density/100)} plants; this region is capped at 200. Spacing and exclusions can reduce the result. Scene limit: 500 generated plants.</FieldMessage>
          <fieldset className="region-exclusions"><legend>Exclude planting from</legend>{(['water','paths','buildings'] as const).map(key=><Field variant="checkbox" key={key}><CheckboxInput aria-label={`Exclude ${key}`} checked={draft.exclusions[key]} onChange={e=>change({...draft,exclusions:{...draft.exclusions,[key]:e.target.checked}})}/>{key[0].toUpperCase()+key.slice(1)}</Field>)}</fieldset>
          <FieldMessage>Clearance applies around river/lake banks, paths and building footprints. Sea level excludes low ground. Hidden objects reserve space too. Spacing is between plant centers; large crowns can overlap.</FieldMessage>
        </>}
      </InspectorSection>
      <InspectorSection sectionId="regioninspector-boundary" title={<>Boundary points · {draft.points.length}/16</>} className="water-details" defaultOpen={false}><FieldMessage>{plant?'Edit X/Z, then preview regeneration to update this boundary and its plants.':'Drag numbered handles or edit X/Z.'} Finish connects the final point to the first.</FieldMessage>
        {draft.points.map((p,i)=><PointEditor key={i} title={<>Point {i+1}</>} actions={<><Button variant="ghost" size="icon-sm" type="button" aria-label={`Insert after region point ${i+1}`} disabled={draft.points.length>=16} onClick={()=>{const points=[...draft.points],n=points[(i+1)%points.length];points.splice(i+1,0,[(p[0]+n[0])/2,(p[1]+n[1])/2]);change({...draft,points});}}><Plus size={14}/></Button><Button variant="ghost" size="icon-sm" type="button" aria-label={`Remove region point ${i+1}`} disabled={draft.points.length<=3} onClick={()=>change({...draft,points:draft.points.filter((_,j)=>i!==j)})}><Trash2 size={14}/></Button></>}><FieldGrid columns={2}>{p.map((v,axis)=><NumberField key={axis} label={`Region point ${i+1} ${axis===0?'X':'Z'}`} value={v} min={-100} max={100} onChange={value=>{const points=draft.points.map(p=>[...p] as PathPoint);points[i][axis]=value;change({...draft,points});}}/>)}</FieldGrid></PointEditor>)}
      </InspectorSection>
      {error&&<p role="alert" className="river-error">{error}</p>}
      <ActionBar pending={!!(pending||state.gestureLabel)}><div><span className="status-dot"/>{error?'Resolve the invalid edit':previewed?`Preview ready${plant?` · ${count} plants`:''}`:pending?'Preview required':'All changes applied'}</div>
        {plant&&<button type="button" className="region-preview" onClick={e=>{if(e.currentTarget.form?.reportValidity())preview();}}>Preview regeneration</button>}
        <Button variant="default" type="submit" className="primary-button" disabled={!previewed||!!error}><Check size={15}/>Apply region changes</Button><Button variant="ghost" type="button" className="cancel-button" disabled={!pending&&!state.gestureLabel} onClick={cancel}><RotateCcw size={14}/>Cancel region preview</Button>
      </ActionBar>
      <ActionRow><Button variant="destructive" size="sm" type="button" className="delete-button" disabled={pending||!!state.gestureLabel} onClick={()=>editor.execute({type:'remove',id:region.id},'Delete region')}><Trash2 size={14}/>Delete region</Button></ActionRow>
    </form>
    <InspectorSection sectionId="regioninspector-notes-1" title="About this object" defaultOpen={false}><FieldMessage>{plant?'Editing an individual generated plant detaches it, including placement, name and visibility changes. Regeneration preserves detached plants and replaces only the remaining owned plants. Deleting a region removes its owned plants; Undo restores them. Deleted owned plants may return on regeneration. After changing water, buildings or paths, preview regeneration to refresh exclusions.':'A stored region covers the evaluated terrain. Removing it reveals the underlying surface and preserves sculpting.'}</FieldMessage></InspectorSection>
  </PanelBody>;
}

