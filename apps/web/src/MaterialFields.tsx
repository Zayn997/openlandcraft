import { Button, ColorField, Field, FieldGrid, FieldMessage, NumberField, Row, SelectInput, SelectOption } from './ui';
import { InspectorSection } from './InspectorSection';
import { TERRAIN_PRESETS, WATER_PRESETS, type TerrainMaterials, type WaterAppearance, type Editor } from '@openlandcraft/core';

const same=(a:object,b:object)=>Object.entries(a).every(([key,value])=>value===(b as Record<string,unknown>)[key]);
export function WaterMaterialFields({appearance,color,onChange}:{appearance:WaterAppearance;color:string;onChange:(change:{appearance:WaterAppearance;color?:string})=>void}) {
  const preset=WATER_PRESETS.find(p=>p.color.toLowerCase()===color.toLowerCase()&&same(p.value,appearance));
  return <InspectorSection sectionId="materialfields-water-material" title={<>Water material</>} className="material-fields" defaultOpen={false}>
    <Field>Preset<SelectInput aria-label="Water preset" value={preset?.id??'custom'} onValueChange={(value) =>{const p=WATER_PRESETS.find(p=>p.id===value);if(p)onChange({appearance:{...p.value},color:p.color});}}><SelectOption value="custom" disabled>Custom</SelectOption>{WATER_PRESETS.map(p=><SelectOption key={p.id} value={p.id}>{p.name}</SelectOption>)}</SelectInput></Field>
    <FieldGrid columns={2}><NumberField label="Water clarity" value={appearance.clarity} min={0.25} max={3} unit="×" onChange={clarity=>onChange({appearance:{...appearance,clarity}})} />
    <NumberField label="Water roughness" value={appearance.roughness} min={0} max={1} unit="" onChange={roughness=>onChange({appearance:{...appearance,roughness}})} />
    <NumberField label="Ripple size" value={appearance.rippleScale} min={0.25} max={4} unit="×" onChange={rippleScale=>onChange({appearance:{...appearance,rippleScale}})} /></FieldGrid>
    <FieldMessage>Higher clarity reveals more of the bottom. Ripple size changes fine surface detail; wave height and spacing stay as authored.</FieldMessage>
  </InspectorSection>;
}

export function TerrainMaterialFields({materials,editor,onEdit,cancel}:{materials:TerrainMaterials;editor:Editor;onEdit:()=>void;cancel:()=>void}) {
  const state=editor.getSnapshot(), editing=state.gestureLabel==='Edit terrain materials',blocked=!!state.gestureLabel&&!editing;
  const preset=TERRAIN_PRESETS.find(p=>same(p.value,materials));
  const begin=()=>{onEdit();if(!editor.getSnapshot().gestureLabel)editor.begin('Edit terrain materials');};
  const change=(next:TerrainMaterials)=>{begin();editor.preview({type:'materials',materials:next});};
  return <InspectorSection sectionId="materialfields-terrain-material" title={<>Surface materials</>} className="terrain-materials" defaultOpen={false}><form onInputCapture={begin} onSubmit={event=>{event.preventDefault();editor.commit();}}>
    <fieldset disabled={blocked} className="material-fields">
      <Field>Palette<SelectInput aria-label="Terrain palette" value={preset?.id??'custom'} onValueChange={(value) =>{const p=TERRAIN_PRESETS.find(p=>p.id===value);if(p)change({...p.value});}}><SelectOption value="custom" disabled>Custom</SelectOption>{TERRAIN_PRESETS.map(p=><SelectOption key={p.id} value={p.id}>{p.name}</SelectOption>)}</SelectInput></Field>
      {(['sand','grass','rock'] as const).map(key=><ColorField key={key} label={`${key[0].toUpperCase()+key.slice(1)} color`} value={materials[key]} onChange={color=>change({...materials,[key]:color})} />)}
      <FieldGrid columns={2}><NumberField label="Terrain detail size" value={materials.scale} min={0.25} max={4} unit="×" onChange={scale=>change({...materials,scale})} />
      <NumberField label="Terrain roughness" value={materials.roughness} min={0.3} max={1} unit="" onChange={roughness=>change({...materials,roughness})} />
      <NumberField label="Rock slope" value={materials.rockSlope} min={20} max={75} unit="°" onChange={rockSlope=>change({...materials,rockSlope})} /></FieldGrid>
      <FieldMessage>Sand follows the coast, river bed, and wet lake banks. Rock appears on steeper slopes. These settings apply across the site.</FieldMessage>
      <Row className="material-actions"><Button variant="default" className="primary-button" type="submit" disabled={!editing}>Apply materials</Button><Button variant="ghost" className="text-button" type="button" disabled={!editing} onClick={cancel}>Cancel materials</Button></Row>
    </fieldset>
  </form></InspectorSection>;
}
