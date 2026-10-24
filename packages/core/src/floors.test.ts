import { defaultLayers } from './layers';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Editor, createBuilding, createProject, createUnit, duplicateAbove, floorHeight, parseProject, scopeParts, type BuildingPart, type Level, type Unit, type Wall } from './index';
import { deserializeProject, loadLocal, saveLocal, serializeProject } from '@openlandcraft/project';
import legacy from '../../../examples/architectural-pavilion.olc.json';

function scene(){
  const editor=new Editor(createProject()),parts=createBuilding(editor.getSnapshot().project,-24,4,10,7,'ground');
  (parts[1] as Wall).openings=[{id:'door',kind:'door',offset:1,width:1,height:2.1,sill:0},{id:'window',kind:'window',offset:4,width:1.2,height:1.1,sill:1}];
  editor.execute({type:'insert',entities:parts},'Building');return editor;
}
function copy(editor:Editor,id:string,prefix:string,height=3.4){
  const result=duplicateAbove(editor.getSnapshot().project,id,height,prefix);
  editor.execute({type:'duplicateAbove',sourceId:id,height,prefix},'Duplicate above');return result;
}
describe('Direct upward repetition',()=>{
  it('migrates v12 without changing geometry, hosts, asset bytes or optional authoring data',()=>{
    const snapshot=structuredClone(legacy),migrated=parseProject(legacy);
    expect(migrated).toEqual({...legacy,version:33,layers:defaultLayers(),objectLayers:{},activeLayerId:"default"});expect(legacy).toEqual(snapshot);
    expect(()=>parseProject({...legacy,entities:[...legacy.entities,{id:'u',kind:'unit',parentId:'site',name:'Future data',visible:true,memberIds:[]}]})).toThrow();
  });
  it('copies a floor twice with new host and opening IDs, fixed elevations and one top roof',()=>{
    const editor=scene(),before=editor.getSnapshot().project,level=before.entities.find(e=>e.id==='ground') as Level;
    expect(floorHeight(before,level)).toBeCloseTo(3.4);
    const first=copy(editor,'ground','first'),second=copy(editor,first.selectedId,'second');
    const after=editor.getSnapshot().project,levels=after.entities.filter(e=>e.kind==='level') as Level[];
    expect(levels).toHaveLength(3);levels.forEach((e,i)=>expect(e.position[1]-level.position[1]).toBeCloseTo(i*3.4));
    expect(new Set(levels.map(l=>l.buildingId)).size).toBe(1);expect(after.entities.filter(e=>e.kind==='building')).toHaveLength(1);
    expect(after.entities.filter(e=>e.kind==='roof')).toHaveLength(1);expect(after.entities.find(e=>e.kind==='roof')!.parentId).toBe(second.levelId);
    const walls=after.entities.filter((e):e is Wall=>e.kind==='wall'&&!!e.openings?.length);
    expect(walls).toHaveLength(3);expect(new Set(walls.flatMap(w=>w.openings!.map(o=>o.id))).size).toBe(6);
    expect(walls[1].openings!.map(({id,...o})=>o)).toEqual(walls[0].openings!.map(({id,...o})=>o));
    expect(after.site).toEqual(before.site);expect(after.assets).toBe(before.assets);
    const upper=walls.find(w=>w.parentId===first.levelId)!;
    editor.execute({type:'replace',entity:{...upper,openings:upper.openings!.map(o=>o.kind==='window'?{...o,width:1.4}:o)}},'Edit middle window');
    expect((editor.getSnapshot().project.entities.find(e=>e.id===walls[0].id) as Wall).openings).toEqual(walls[0].openings);
    expect((editor.getSnapshot().project.entities.find(e=>e.id===walls[2].id) as Wall).openings).toEqual(walls[2].openings);
  });
  it('previews from the baseline, cancels without history and commits each copy as one undo entry',()=>{
    const editor=scene(),before=editor.getSnapshot().project,count=editor.getSnapshot().past.length;
    editor.begin('Preview copy');editor.preview({type:'duplicateAbove',sourceId:'ground',height:3.4,prefix:'draft'});
    expect(editor.getSnapshot().project).toBe(before);editor.cancel();expect(editor.getSnapshot().project).toBe(before);expect(editor.getSnapshot().past).toHaveLength(count);
    copy(editor,'ground','one');const first=editor.getSnapshot().project;copy(editor,'one-level','two');const second=editor.getSnapshot().project;
    expect(editor.getSnapshot().past).toHaveLength(count+2);editor.undo();expect(editor.getSnapshot().project).toEqual(first);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();editor.redo();expect(editor.getSnapshot().project).toEqual(second);
  });
  it('groups a unit and repeats its members without copying a neighboring unit',()=>{
    const editor=scene(),initial=editor.getSnapshot().project;
    const neighbor=createBuilding(initial,-24,4,4,4,'neighbor').filter((e):e is BuildingPart=>e.kind==='wall'||e.kind==='slab'||e.kind==='roof').map((e):BuildingPart=>e.kind==='wall'
      ? {...e,parentId:'ground',start:[e.start[0]+18,e.start[1]],end:[e.end[0]+18,e.end[1]]}
      : {...e,parentId:'ground',center:[e.center[0]+18,e.center[1]]});
    editor.execute({type:'insert',entities:neighbor},'Neighbor');
    const a=createUnit(editor.getSnapshot().project,scopeParts(initial,'ground').map(p=>p.id),'Home A','unit-a');editor.execute({type:'add',entity:a},'Group A');
    const b=createUnit(editor.getSnapshot().project,neighbor.map(p=>p.id),'Home B','unit-b');editor.execute({type:'add',entity:b},'Group B');
    const result=copy(editor,a.id,'up-a'),afterA=editor.getSnapshot().project;
    expect(scopeParts(afterA,result.selectedId)).toHaveLength(6);expect(scopeParts(afterA,b.id)).toEqual(neighbor);
    const resultB=copy(editor,b.id,'up-b');expect(resultB.levelId).toBe(result.levelId);
    expect(editor.getSnapshot().project.entities.filter(e=>e.kind==='level')).toHaveLength(2);
    const upper=editor.getSnapshot().project.entities.find(e=>e.id===result.selectedId) as Unit;
    expect(upper.memberIds.every(id=>editor.getSnapshot().project.entities.find(e=>e.id===id)?.parentId===upper.parentId)).toBe(true);
    copy(editor,result.selectedId,'again');expect(editor.getSnapshot().project.entities.filter(e=>e.kind==='unit')).toHaveLength(5);
  });
  it('remaps grouped units when the whole floor is copied and transfers roof membership',()=>{
    const editor=scene(),u=createUnit(editor.getSnapshot().project,scopeParts(editor.getSnapshot().project,'ground').map(p=>p.id),'Home','unit');editor.execute({type:'add',entity:u},'Group');
    const result=copy(editor,'ground','upper'),after=editor.getSnapshot().project,units=after.entities.filter((e):e is Unit=>e.kind==='unit');
    expect(units).toHaveLength(2);expect(units.find(u=>u.parentId==='ground')!.memberIds).not.toContain('ground-roof');
    expect(units.find(u=>u.parentId===result.levelId)!.memberIds).toContain('ground-roof');expect(()=>parseProject(after)).not.toThrow();
  });
  it('rejects partial connected walls, cross-floor groups, shared ownership and malformed members',()=>{
    const editor=scene(),p=editor.getSnapshot().project;
    expect(()=>createUnit(p,['ground-wall-0'])).toThrow('complete joined');
    const unit=createUnit(p,scopeParts(p,'ground').map(e=>e.id),'A','unit');editor.execute({type:'add',entity:unit},'Group');
    expect(()=>createUnit(editor.getSnapshot().project,unit.memberIds)).toThrow('already belong');
    expect(()=>editor.execute({type:'add',entity:{...unit,id:'shared'}},'Bad group')).toThrow('only one unit');
    expect(()=>parseProject({...p,entities:[...p.entities,{...unit,memberIds:['missing']}]})).toThrow('same floor');
  });
  it('rejects collisions and insufficient height without changing history or committed geometry',()=>{
    const editor=scene(),before=editor.getSnapshot();
    expect(()=>copy(editor,'ground','short',2)).toThrow('at least');expect(editor.getSnapshot()).toBe(before);
    copy(editor,'ground','upper');const built=editor.getSnapshot();expect(()=>copy(editor,'ground','overlap')).toThrow('already exists');expect(editor.getSnapshot()).toBe(built);
    expect(()=>copy(editor,'upper-level','midway',3)).toThrow();
    const other=createBuilding(built.project,-24,4,10,7,'obstacle');(other[0] as Level).position[1]+=(3.4*2);
    editor.execute({type:'insert',entities:other},'Obstacle');const obstacle=editor.getSnapshot();
    expect(()=>copy(editor,'upper-level','blocked')).toThrow('overlap');expect(editor.getSnapshot()).toBe(obstacle);
  });
  it('preserves rotated geometry and rejects shifted destination floors',()=>{
    const editor=scene(),level=editor.getSnapshot().project.entities.find(e=>e.id==='ground') as Level;
    editor.execute({type:'replace',entity:{...level,rotation:37}},'Rotate');const first=copy(editor,'ground','upper');
    const upper=editor.getSnapshot().project.entities.find(e=>e.id===first.levelId) as Level;expect(upper.rotation).toBe(37);expect(scopeParts(editor.getSnapshot().project,upper.id).filter(e=>e.kind==='wall').map(e=>e.start)).toEqual(scopeParts(editor.getSnapshot().project,'ground').filter(e=>e.kind==='wall').map(e=>e.start));
    const unit=createUnit(editor.getSnapshot().project,scopeParts(editor.getSnapshot().project,'ground').map(e=>e.id),'Unit','unit');editor.execute({type:'add',entity:unit},'Group');
    editor.execute({type:'replace',entity:{...upper,rotation:45}},'Rotate upper');expect(()=>copy(editor,'unit','bad')).toThrow('different origin');
  });
  it('enforces entity and elevation budgets before committing a copy',()=>{
    const editor=scene(),p=editor.getSnapshot().project,level=p.entities.find(e=>e.id==='ground') as Level;
    editor.execute({type:'replace',entity:{...level,position:[level.position[0],99,level.position[2]]}},'High level');expect(()=>copy(editor,'ground','too-high')).toThrow('100 m');
    const block=p.entities.find(e=>e.kind==='block')!;
    const full=parseProject({...p,entities:[...p.entities,...Array.from({length:1000-p.entities.length},(_,i)=>({...block,id:`extra-${i}`}))]});
    expect(()=>duplicateAbove(full,'ground',3.4,'budget')).toThrow('1,000');
  });
  it('deletes a unit, a floor or a building without orphan members and restores them with undo',()=>{
    const editor=scene(),u=createUnit(editor.getSnapshot().project,scopeParts(editor.getSnapshot().project,'ground').map(e=>e.id),'Unit','unit');editor.execute({type:'add',entity:u},'Group');
    const result=copy(editor,'unit','upper'),before=editor.getSnapshot().project;
    editor.execute({type:'remove',id:'ground-wall-0'},'Remove member');expect(()=>parseProject(editor.getSnapshot().project)).not.toThrow();editor.undo();
    editor.execute({type:'ungroup',id:result.selectedId},'Ungroup');expect(scopeParts(editor.getSnapshot().project,result.levelId).length).toBeGreaterThan(0);editor.undo();
    for(const id of [result.selectedId,result.levelId,'upper-building']){editor.execute({type:'remove',id},'Delete');expect(()=>parseProject(editor.getSnapshot().project)).not.toThrow();editor.undo();expect(editor.getSnapshot().project).toEqual(before);}
  });
  it('round trips stacked units and roofs through portable and local storage',async()=>{
    const editor=scene(),u=createUnit(editor.getSnapshot().project,scopeParts(editor.getSnapshot().project,'ground').map(e=>e.id),'Unit','unit');editor.execute({type:'add',entity:u},'Group');
    const first=copy(editor,'unit','one');copy(editor,first.selectedId,'two');const p=editor.getSnapshot().project;
    expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);
  });
});
