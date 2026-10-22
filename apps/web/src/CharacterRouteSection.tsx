import { Plus, Route, Trash2 } from 'lucide-react';
import type { Instance, WalkingRoute } from '@openlandcraft/core';
import { pathLength, roundedRoutePoints, type PathPoint } from '@openlandcraft/landscape';
import { InspectorSection } from './InspectorSection';
import { Button, FieldGrid, FieldMessage, NumberField, PointEditor, PropertyRow, Row } from './ui';

export function CharacterRouteSection({entity,pending,onChange,onDraw,onFrame,onSelectCorner}:{
  entity:Instance;pending:boolean;onChange:(patch:Partial<Instance>)=>void;onDraw:()=>void;onFrame:()=>void;
  onSelectCorner:(index:number|null)=>void;
}) {
  const route=entity.walkingRoute;
  const change=(walkingRoute:WalkingRoute)=>onChange({walkingRoute});
  const insert=(index:number)=>{if(!route)return;const points=[...route.points],point=points[index],next=points[index+1],cornerRounding=route.cornerRounding?.slice();points.splice(index+1,0,[(point[0]+next[0])/2,(point[1]+next[1])/2]);cornerRounding?.splice(index+1,0,0);onSelectCorner(null);change({...route,points,...(cornerRounding?{cornerRounding}:{})});};
  const remove=(index:number)=>{if(!route)return;const points=route.points.filter((_,i)=>i!==index),cornerRounding=route.cornerRounding?.filter((_,i)=>i!==index).map((value,i,array)=>i===0||i===array.length-1?0:value);onSelectCorner(null);change({...route,points,...(cornerRounding?{cornerRounding}:{})});};
  return <>
    <InspectorSection sectionId="character-route" title="Walking route">
      <FieldMessage>{route ? 'Click a numbered corner to adjust rounding. Drag anchors to move them, or edit points below. Only this person follows the route.' : 'Draw a route for this person. Landscape paths and other people’s routes stay unchanged.'}</FieldMessage>
      {route && <PropertyRow><span>Route length</span><strong>{pathLength(roundedRoutePoints(route)).toFixed(1)} m · {route.points.length} points</strong></PropertyRow>}
      <Row wrap><Button variant="outline" disabled={pending} onClick={onDraw}><Route size={15}/>{route ? 'Redraw route' : 'Draw route'}</Button>
        {route && <Button variant="ghost" disabled={pending} onClick={onFrame}>Frame route</Button>}</Row>
      {route && <>
        <NumberField label="Walking corridor width" value={route.width} min={0.5} max={8} onChange={width=>change({...route,width})}/>
        <FieldMessage>The corridor gives this person room to avoid obstacles. It does not add a surface to the terrain.</FieldMessage>
        <Button variant="ghost" size="sm" disabled={pending} onClick={()=>onChange({walkingRoute:undefined})}><Trash2 size={14}/>Remove route</Button>
      </>}
    </InspectorSection>
    {route && <InspectorSection sectionId="character-route-points" title="Route points" defaultOpen={false}>
      {route.points.map((point,index)=><PointEditor key={index} title={`Point ${index+1}${index===0?' · Start':index===route.points.length-1?' · End':''}`} actions={<>
        {index>0&&index<route.points.length-1&&<Button variant="ghost" size="sm" disabled={pending} aria-label={`Round route corner ${index+1}`} onClick={()=>onSelectCorner(index)}>Round corner</Button>}
        <Button variant="ghost" size="icon-sm" aria-label={`Insert after route point ${index+1}`} disabled={index===route.points.length-1||route.points.length>=16} onClick={()=>insert(index)}><Plus size={14}/></Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove route point ${index+1}`} disabled={route.points.length<=2} onClick={()=>remove(index)}><Trash2 size={14}/></Button>
      </>}>
        <FieldGrid columns={2}>{point.map((value,axis)=><NumberField key={axis} label={`Route point ${index+1} ${axis===0?'X':'Z'}`} value={value} min={-100} max={100} onChange={value=>{const points=route.points.map(p=>[...p] as PathPoint);points[index][axis]=value;change({...route,points});}}/>)}</FieldGrid>
      </PointEditor>)}
    </InspectorSection>}
  </>;
}
