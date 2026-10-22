import { Route } from 'lucide-react';
import type { Path } from '@openlandcraft/core';
import { pathLength, roundedRoutePoints, type PathPoint } from '@openlandcraft/landscape';
import { Button, CheckboxInput, Field, FieldMessage, NumberField, PanelBody, PanelHeading, PropertyRow, Row, SelectInput, SelectOption } from './ui';
import { InspectorSection } from './InspectorSection';

export function PathDrawingPanel({points,width,surface,redrawing,error,snapping,characterName,cornerRounding,onWidth,onSurface,onSnapping,onFinish,onBack,onCancel}: {
  points:PathPoint[];width:number;surface:Path['surface'];redrawing:boolean;error:string|null;snapping:boolean;
  characterName?:string;
  cornerRounding?:number[];
  onWidth:(value:number)=>void;onSurface:(value:Path['surface'])=>void;onSnapping:(value:boolean)=>void;
  onFinish:()=>void;onBack:()=>void;onCancel:()=>void;
}) {
  return <PanelBody aria-label="Path drawing">
    <PanelHeading title={characterName ? redrawing ? 'Redraw route' : 'Draw route' : redrawing ? 'Redraw path' : 'Draw path'} icon={<Route size={23}/>} subtitle={characterName ? `Walking route · ${characterName}` : 'Click the route on the terrain'}/>
    <FieldMessage>Click the start, each corner, and the end in the viewer. Finish {characterName ? 'route' : 'path'} creates the route through your points.</FieldMessage>
    <FieldMessage>Drag to pan. Scroll or pinch to zoom. Navigation does not add points.</FieldMessage>
    <FieldMessage>Click a numbered anchor again to round its corner.</FieldMessage>
    {redrawing && <FieldMessage>The existing route stays until you finish. Cancel keeps it.</FieldMessage>}
    <InspectorSection sectionId="path-drawing-surface" title={characterName ? 'Walking corridor' : 'Path surface'}>
      <NumberField label={characterName ? 'Walking corridor width' : 'Path width'} value={width} min={0.5} max={8} onChange={onWidth}/>
      {!characterName && <Field>Surface<SelectInput aria-label="Path surface" value={surface} onValueChange={value => onSurface(value as Path['surface'])}>
        <SelectOption value="gravel">Gravel</SelectOption><SelectOption value="paving">Stone paving</SelectOption><SelectOption value="timber">Timber</SelectOption>
      </SelectInput></Field>}
      <Field variant="checkbox"><CheckboxInput aria-label="Snap drawing path" checked={snapping} onChange={event => onSnapping(event.target.checked)}/>Snap to grid and building edges</Field>
      <FieldMessage>{characterName ? 'Only this person follows the route. The corridor is a guide, with no surface added to the terrain.' : 'People have their own walking routes. This path adds a landscape surface.'}</FieldMessage>
    </InspectorSection>
    <InspectorSection sectionId="path-drawing-progress" title="Drawing">
      <PropertyRow><span>Points</span><strong>{points.length} / 16</strong></PropertyRow>
      <PropertyRow><span>Length</span><strong>{pathLength(roundedRoutePoints({points,width,cornerRounding})).toFixed(1)} m</strong></PropertyRow>
      {error && <FieldMessage tone="error" role="alert">{error}</FieldMessage>}
      <Row wrap className="mt-3"><Button disabled={points.length < 2 || !!error} onClick={onFinish}>Finish {characterName ? 'route' : 'path'}</Button><Button variant="outline" disabled={!points.length} onClick={onBack}>Back one point</Button></Row>
      <Button variant="ghost" className="mt-2" onClick={onCancel}>Cancel drawing</Button>
      <FieldMessage>Finish is one undo step. Escape cancels the drawing.</FieldMessage>
    </InspectorSection>
  </PanelBody>;
}
