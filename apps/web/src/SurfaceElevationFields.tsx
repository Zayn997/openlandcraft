import type {Path,MaterialRegion,Project} from '@openlandcraft/core';
import {pathLength,roundedRoutePoints,terrainTriangleHeight,terrainCellDiagonal} from '@openlandcraft/landscape';
import {Field,FieldGrid,FieldMessage,NumberField,PropertyRow,SelectInput,SelectOption} from './ui';

export function SurfaceElevationFields<T extends Path|MaterialRegion>({surface,site,onChange}:{surface:T;site:Project['site'];onChange:(next:T)=>void}){
  const mode=surface.elevationMode??'terrain',path=surface.kind==='path',minimum=Math.ceil((terrainCellDiagonal(site)*1.01+.25)*10)/10;
  const changeMode=(value:string)=>{
    const {elevation,endElevation,gradingWidth,...base}=surface;
    if(value==='terrain'){onChange({...base,elevationMode:path?'terrain':undefined} as T);return;}
    const height=elevation??Number(terrainTriangleHeight(site,surface.points[0]).toFixed(2));
    onChange({...base,elevationMode:value,elevation:height,...(path?{endElevation:endElevation??height}:{}),...(value==='graded'?{gradingWidth:gradingWidth??Math.max(3,minimum)}:{})} as T);
  };
  return <>
    <Field>Elevation mode<SelectInput aria-label="Surface elevation mode" value={mode} onValueChange={changeMode}><SelectOption value="terrain">Follow terrain</SelectOption><SelectOption value="fixed">Fixed elevation</SelectOption><SelectOption value="graded">Grade terrain</SelectOption></SelectInput></Field>
    {mode!=='terrain'&&<FieldGrid columns={path?2:'auto'}>
      <NumberField label={path?'Start elevation':'Surface elevation'} value={surface.elevation??0} min={-8} max={30} onChange={elevation=>onChange({...surface,elevation})}/>
      {path&&<NumberField label="End elevation" value={surface.endElevation??surface.elevation??0} min={-8} max={30} onChange={endElevation=>onChange({...surface,endElevation})}/>}
    </FieldGrid>}
    {mode!=='terrain'&&path&&<PropertyRow><span>Plan slope</span><strong>{(100*((surface.endElevation??surface.elevation??0)-(surface.elevation??0))/(pathLength(roundedRoutePoints(surface))||1)).toFixed(1)}%</strong></PropertyRow>}
    {mode==='graded'&&<NumberField label="Grading transition" value={surface.gradingWidth??3} min={minimum} max={20} onChange={gradingWidth=>onChange({...surface,gradingWidth})}/>}
    <FieldMessage>{mode==='terrain'?'Follows terrain sculpting and water carving.':mode==='fixed'?'Sets surface elevations without moving terrain. Ground can cover a lower surface; use Grade terrain to cut or fill. A raised surface has no bridge supports or deck thickness.':'Cuts or fills terrain to the surface, blending back to the original ground across the transition. The grade follows boundary edits; hiding or deleting its object removes the terrain effect. Keep the transition inside the site and clear of water and banks.'}</FieldMessage>
    {mode!=='terrain'&&<FieldMessage>Elevations use site zero. Surfaces join only where their elevations match. Different elevations remain separate. Preview in the viewport, then Apply with the surface changes.</FieldMessage>}
  </>;
}
