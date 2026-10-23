import {spiralStairsForTower,spiralTowerClearRadius,type StairDrawingDimensions,type StairShape,type Level,type Wall,type WallShape,type RoofShape} from '@openlandcraft/core';
import { Button, CheckboxInput, Field, FieldMessage, NumberField, Panel, PanelHeading, Row, SelectInput, SelectOption } from './ui';

export type ArchitectureTool = 'wall' | 'floor' | 'roof' | 'stairs';
export function ArchitectureTools({ kind, levels, level, count, offset, thickness, snapping, stairShape,onStairShape,stairTowerId,onStairTower,onFitStairTower,stairDimensions,onStairDimensions,wallShape, wallHeight, clockwise, onWallShape, onWallHeight, onClockwise,roofShape,roofHeight,roofOverhang,roofTowerId,roofTowers,onRoofShape,onRoofHeight,onRoofOverhang,onRoofTower,onFitTower, onLevel, onNewLevel, onOffset, onThickness, onSnapping, onFinish, onBack, onCancel, onExit }: {
  kind: ArchitectureTool; levels: Level[]; level?: Level; count: number; offset: number; thickness: number; snapping: boolean;
  onLevel: (id: string) => void; onNewLevel: () => void; onOffset: (n: number) => void; onThickness: (n: number) => void;
  onSnapping: (value: boolean) => void; onFinish: (closed: boolean) => void; onBack: () => void; onCancel: () => void; onExit: () => void;
  stairDimensions:StairDrawingDimensions;onStairDimensions:(value:StairDrawingDimensions)=>void;
  stairShape:StairShape;onStairShape:(shape:StairShape)=>void;stairTowerId:string;onStairTower:(id:string)=>void;onFitStairTower:()=>void;
  wallShape:WallShape;wallHeight:number;clockwise:boolean;onWallShape:(shape:WallShape)=>void;onWallHeight:(value:number)=>void;onClockwise:(value:boolean)=>void;
  roofShape:RoofShape;roofHeight:number;roofOverhang:number;roofTowerId:string;roofTowers:Wall[];onRoofShape:(shape:RoofShape)=>void;onRoofHeight:(n:number)=>void;onRoofOverhang:(n:number)=>void;onRoofTower:(id:string)=>void;onFitTower:()=>void;
}) {
  const stairs=kind==='stairs',label = stairs?'Stairs':kind === 'wall' ? 'Wall' : kind === 'floor' ? 'Floor' : 'Roof';
  const spiral=stairs&&stairShape==='spiral',stairTower=roofTowers.find(w=>w.id===stairTowerId);
  let stairIssue='';if(spiral&&stairTower)try{spiralStairsForTower(stairTower,stairDimensions);}catch(error){stairIssue=error instanceof Error?error.message:'Invalid spiral stairs.';}
  const curved=kind==='wall'&&wallShape!=='straight';
  const conical=kind==='roof'&&roofShape==='conical',tower=roofTowers.find(w=>w.id===roofTowerId),autoFinish=curved||conical||stairs;
  const instruction=wallShape==='circle'?(count?'Click a radius point to create the circular wall.':'Click the center, then a radius point.'):count===0?'Click the arc center.':count===1?'Click the start point to set the radius.':'Click the end direction to create the arc.';
  return <Panel padding="body" aria-label="Architecture drawing">
    <PanelHeading title={`Draw ${label.toLowerCase()}`} subtitle="CHOOSE LEVEL · DRAW · FINISH" />
    {stairs&&<Row role="group" aria-label="Stair shape">{(['straight','spiral'] as const).map(shape=><Button key={shape} variant={stairShape===shape?'default':'outline'} aria-pressed={stairShape===shape} onClick={()=>onStairShape(shape)}>{shape==='straight'?'Straight':'Spiral'}</Button>)}</Row>}
    {kind==='wall'&&<Row role="group" aria-label="Wall shape">{(['straight','arc','circle'] as const).map(shape=><Button key={shape} variant={wallShape===shape?'default':'outline'} aria-pressed={wallShape===shape} onClick={()=>onWallShape(shape)}>{shape==='straight'?'Straight':shape==='arc'?'Arc':'Circle'}</Button>)}</Row>}
    {kind==='roof'&&<Row role="group" aria-label="Roof shape">{(['flat','conical'] as const).map(shape=><Button key={shape} variant={roofShape===shape?'default':'outline'} aria-pressed={roofShape===shape} onClick={()=>onRoofShape(shape)}>{shape==='flat'?'Flat':'Conical'}</Button>)}</Row>}
    <Field>Drawing level<SelectInput aria-label="Drawing level" value={level?.id ?? ''} placeholder="Choose a level" disabled={count > 0 || !levels.length} onValueChange={onLevel}>
      {levels.map(item => <SelectOption key={item.id} value={item.id}>{item.name} · {item.position[1].toFixed(2)} m</SelectOption>)}
    </SelectInput></Field>
    <Button variant="outline" disabled={count > 0} onClick={onNewLevel}>Add blank level</Button>
    {count > 0 && <FieldMessage>Finish or cancel this drawing before changing level.</FieldMessage>}
    {level && <FieldMessage>{level.name} · elevation {level.position[1].toFixed(2)} m. {stairs?'Stairs belong to this level; other levels remain visible for alignment.':'Drawing stays on this level; other levels are temporarily hidden.'}</FieldMessage>}
    {kind === 'wall' && <>
      <NumberField label="Wall thickness" value={thickness} min={0.05} max={2} unit="m" onChange={onThickness} />
      {curved?<>
        <NumberField label="Wall height" value={wallHeight} min={0.2} max={30} onChange={onWallHeight}/>
        <NumberField label="Base elevation" value={offset} min={-10} max={30} onChange={onOffset}/>
        {wallShape==='arc'&&<Field variant="checkbox"><CheckboxInput checked={clockwise} onChange={e=>onClockwise(e.target.checked)}/>Clockwise arc</Field>}
        <FieldMessage>{instruction} The final click creates one editable wall. Radius follows the centerline; edit radius, thickness and height after drawing.</FieldMessage>
        <FieldMessage>Snap an arc endpoint to a straight wall, or draw a straight wall to a curve. Joins keep each thickness; height and base follow the connected walls. Use the Door or Window tool for rectangular or arched openings.</FieldMessage>
      </>:<FieldMessage>Draw to a wall endpoint for a corner, or to its middle for an interior connection. Joined walls keep their own thickness. Height and base follow the connected walls.</FieldMessage>}
    </>}
    {conical&&<>
      <NumberField label="Roof height" value={roofHeight} min={.1} max={15} unit="m" onChange={onRoofHeight}/>
      <NumberField label="Roof overhang" value={roofOverhang} min={0} max={10} unit="m" onChange={onRoofOverhang}/>
      <Field>Roof placement<SelectInput aria-label="Roof placement" value={tower?.id??'draw'} disabled={count>0} onValueChange={onRoofTower}><SelectOption value="draw">Draw center and radius</SelectOption>{roofTowers.map(w=><SelectOption key={w.id} value={w.id}>Fit to {w.name}</SelectOption>)}</SelectInput></Field>
      {tower?<><FieldMessage>Support radius {(tower.curve!.radius+tower.thickness/2).toFixed(2)} m · eaves {(tower.elevation+tower.height).toFixed(2)} m above this level.</FieldMessage><Button onClick={onFitTower}>Place roof on tower</Button></>:<NumberField label="Eaves elevation" value={offset} min={-10} max={40} unit="m" onChange={onOffset}/>}
      <FieldMessage>Radius reaches the wall's outer face; overhang extends beyond it. Height runs from eaves to apex. Fitted roofs follow their tower automatically while height and overhang remain editable.</FieldMessage>
    </>}
    {stairs&&<>
      <FieldMessage>{spiral?'Spiral flight · click the center, then the lower start direction. Entered radius sets the outer edge.':'Straight flight · click the lower start, then its uphill direction. Total run sets the upper-end distance.'}</FieldMessage>
      {spiral&&<>
        <Field>Stair placement<SelectInput aria-label="Stair placement" value={stairTower?.id??'draw'} disabled={count>0} onValueChange={onStairTower}><SelectOption value="draw">Draw center and start direction</SelectOption>{roofTowers.map(w=><SelectOption key={w.id} value={w.id}>Fit inside {w.name}</SelectOption>)}</SelectInput></Field>
        <NumberField label="Stair radius" value={stairDimensions.radius} min={.75} max={20} unit="m" onChange={radius=>onStairDimensions({...stairDimensions,radius})}/>
      </>}
      <NumberField label="Stair width" value={stairDimensions.width} min={.5} max={8} unit="m" onChange={width=>onStairDimensions({...stairDimensions,width})}/>
      <NumberField label={spiral?'Total height':'Total rise'} value={stairDimensions.rise} min={.2} max={30} unit="m" onChange={rise=>onStairDimensions({...stairDimensions,rise})}/>
      {spiral?<><NumberField label="Turns" value={stairDimensions.turns} min={.25} max={4} unit="turns" onChange={turns=>onStairDimensions({...stairDimensions,turns})}/><Field variant="checkbox"><CheckboxInput checked={stairDimensions.clockwise} onChange={e=>onStairDimensions({...stairDimensions,clockwise:e.target.checked})}/>Clockwise stairs</Field></>:<NumberField label="Total run" value={stairDimensions.run} min={.5} max={40} unit="m" onChange={run=>onStairDimensions({...stairDimensions,run})}/>}
      <NumberField label="Step count" value={stairDimensions.steps} min={1} max={128} step={1} unit="steps" onChange={steps=>onStairDimensions({...stairDimensions,steps})}/>
      {(!spiral||!stairTower)&&<NumberField label="Base elevation" value={offset} min={-10} max={30} unit="m" onChange={onOffset}/>}
      <FieldMessage>Upper elevation {((spiral&&stairTower?stairTower.elevation:offset)+stairDimensions.rise).toFixed(2)} m above level · step rise {(stairDimensions.rise/stairDimensions.steps).toFixed(3)} m / tread {((spiral?(stairDimensions.radius-stairDimensions.width/2)*Math.PI*2*stairDimensions.turns:stairDimensions.run)/stairDimensions.steps).toFixed(3)} m. Match these elevations to floor tops or wall walks.</FieldMessage>
      {spiral&&stairTower&&<><FieldMessage>Available radius {spiralTowerClearRadius(stairTower).toFixed(2)} m after wall and walk-deck clearance. Stairs and railings must stay below the wall top.</FieldMessage>{stairIssue&&<FieldMessage tone="error" role="alert">{stairIssue}</FieldMessage>}<Button disabled={!!stairIssue} onClick={onFitStairTower}>Place spiral stairs in tower</Button></>}
    </>}
    {kind !== 'wall'&&!conical&&!stairs && <>
      <NumberField label="Base offset" value={offset} min={-10} max={kind === 'roof' ? 40 : 30} unit="m" onChange={onOffset} />
      <NumberField label="Thickness" value={thickness} min={kind === 'roof' ? 0.1 : 0.05} max={kind === 'roof' ? 15 : 2} unit="m" onChange={onThickness} />
      <FieldMessage>{kind === 'roof' ? 'Draw a flat roof outline. Base offset is its underside above the level; thickness extends upward.' : 'Draw a closed floor boundary. Base offset is the underside of the slab above the level.'}</FieldMessage>
    </>}
    <Field variant="checkbox"><CheckboxInput checked={snapping} onChange={event => onSnapping(event.target.checked)} />{stairs?spiral?'Snap center to 0.25 m and start angle to 15°':'Snap start to 0.25 m and direction to 15°':conical?'Snap center and radius to 0.25 m':'Snap to walls and 0.25 m grid'}</Field>
    <p role="status">{!level ? 'Choose a level above, or add a blank level to begin.' : stairs?spiral?stairTower?'Preview the spiral, then Place spiral stairs in tower.':count?'Click the lower start direction to create spiral stairs.':'Click the spiral center, then the lower start direction.':count?'Click the uphill direction to create stairs.':'Click the lower start, then the uphill direction.':conical?tower?'Preview the roof, then Place roof on tower.':count?'Click the support radius to create the conical roof.':'Click a center, then a support radius point.':curved?instruction:`${count} corners · Click points in the viewport. ${kind === 'wall' ? 'Finish an open chain or close a room.' : 'Finish closes the outline.'}`}</p>
    {!autoFinish&&<Row className="part-buttons">
      <Button disabled={!level || count < (kind === 'wall' ? 2 : 3)} onClick={() => onFinish(kind !== 'wall')}>Finish {label.toLowerCase()}</Button>
      {kind === 'wall' && <Button disabled={!level || count < 3} onClick={() => onFinish(true)}>Close room</Button>}
    </Row>}
    <Row className="part-buttons"><Button variant="outline" disabled={!count} onClick={onBack}>Back one point</Button><Button variant="ghost" disabled={!count} onClick={onCancel}>Cancel drawing</Button></Row>
    <FieldMessage>Each finished drawing is one undo step. Escape cancels the draft and exits the tool.{!autoFinish&&' Click the first corner to close an outline.'}</FieldMessage>
    <Button variant="outline" onClick={onExit}>Exit {label.toLowerCase()} tool</Button>
  </Panel>;
}
