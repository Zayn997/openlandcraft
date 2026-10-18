import { TERRAIN_PRESETS, WATER_PRESETS, type TerrainMaterials, type WaterAppearance, type Editor } from '@openlandcraft/core';
import { NumberField } from './NumberField';
import './materials.css';

const same=(a:object,b:object)=>Object.entries(a).every(([key,value])=>value===(b as Record<string,unknown>)[key]);
function ColorField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) {
  return <label className="color-field"><input type="color" aria-label={label} value={value} onChange={event=>onChange(event.target.value)} /><span>{label}</span><code>{value.toUpperCase()}</code></label>;
}
export function WaterMaterialFields({appearance,color,onChange}:{appearance:WaterAppearance;color:string;onChange:(change:{appearance:WaterAppearance;color?:string})=>void}) {
  const preset=WATER_PRESETS.find(p=>p.color.toLowerCase()===color.toLowerCase()&&same(p.value,appearance));
  return <section className="property-section material-fields"><h3>Water material</h3>
    <label className="material-select">Preset<select aria-label="Water preset" value={preset?.id??'custom'} onChange={event=>{const p=WATER_PRESETS.find(p=>p.id===event.target.value);if(p)onChange({appearance:{...p.value},color:p.color});}}><option value="custom" disabled>Custom</option>{WATER_PRESETS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="material-grid"><NumberField label="Water clarity" value={appearance.clarity} min={0.25} max={3} unit="×" onChange={clarity=>onChange({appearance:{...appearance,clarity}})} />
    <NumberField label="Water roughness" value={appearance.roughness} min={0} max={1} unit="" onChange={roughness=>onChange({appearance:{...appearance,roughness}})} />
    <NumberField label="Ripple size" value={appearance.rippleScale} min={0.25} max={4} unit="×" onChange={rippleScale=>onChange({appearance:{...appearance,rippleScale}})} /></div>
    <p className="field-hint">Higher clarity reveals more of the bottom. Ripple size changes fine surface detail; wave height and spacing stay as authored.</p>
  </section>;
}

export function TerrainMaterialFields({materials,editor,onEdit,cancel}:{materials:TerrainMaterials;editor:Editor;onEdit:()=>void;cancel:()=>void}) {
  const state=editor.getSnapshot(), editing=state.gestureLabel==='Edit terrain materials',blocked=!!state.gestureLabel&&!editing;
  const preset=TERRAIN_PRESETS.find(p=>same(p.value,materials));
  const begin=()=>{onEdit();if(!editor.getSnapshot().gestureLabel)editor.begin('Edit terrain materials');};
  const change=(next:TerrainMaterials)=>{begin();editor.preview({type:'materials',materials:next});};
  return <details className="terrain-materials" open><summary>Surface materials</summary><form onInputCapture={begin} onSubmit={event=>{event.preventDefault();editor.commit();}}>
    <fieldset disabled={blocked} className="material-fields">
      <label className="material-select">Palette<select aria-label="Terrain palette" value={preset?.id??'custom'} onChange={event=>{const p=TERRAIN_PRESETS.find(p=>p.id===event.target.value);if(p)change({...p.value});}}><option value="custom" disabled>Custom</option>{TERRAIN_PRESETS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {(['sand','grass','rock'] as const).map(key=><ColorField key={key} label={`${key[0].toUpperCase()+key.slice(1)} color`} value={materials[key]} onChange={color=>change({...materials,[key]:color})} />)}
      <div className="material-grid"><NumberField label="Terrain detail size" value={materials.scale} min={0.25} max={4} unit="×" onChange={scale=>change({...materials,scale})} />
      <NumberField label="Terrain roughness" value={materials.roughness} min={0.3} max={1} unit="" onChange={roughness=>change({...materials,roughness})} />
      <NumberField label="Rock slope" value={materials.rockSlope} min={20} max={75} unit="°" onChange={rockSlope=>change({...materials,rockSlope})} /></div>
      <p className="field-hint">Sand follows the coast, river bed, and wet lake banks. Rock appears on steeper slopes. These settings apply across the site.</p>
      <div className="material-actions"><button className="primary-button" type="submit" disabled={!editing}>Apply materials</button><button className="text-button" type="button" disabled={!editing} onClick={cancel}>Cancel materials</button></div>
    </fieldset>
  </form></details>;
}
