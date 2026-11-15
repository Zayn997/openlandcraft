import { describe, expect, it } from 'vitest';
import { createSite, createWallChain, drawingPoint, Editor, parseProject, resolveWallDrawingSnap, resolveWallDrag, type Level, type Wall } from './index';
import { deserializeProject, serializeProject } from '@openlandcraft/project';

const level: Level = { id:'floor', kind:'level', parentId:'site', name:'Floor', visible:true, position:[0,0,0], rotation:0 };
const wall = (id:string, start:[number,number], end:[number,number]):Wall => ({id,kind:'wall',parentId:level.id,name:id,visible:true,joins:true,color:'#aaaaaa',start,end,height:3.2,thickness:.25,elevation:0,openings:[]});

describe('Wall axis constraints and endpoint feedback',()=>{
  it('highlights an approaching endpoint before snapping, then clears outside the approach zone',()=>{
    const target=wall('target',[5,0],[5,5]);
    const approaching=resolveWallDrawingSnap([4.4,0],[target],[0,0],true,false);
    expect(approaching.nearEndpoint?.point).toEqual([5,0]);
    expect(approaching.endpoint).toBeUndefined();
    expect(approaching.point).toEqual([4.5,0]);
    const snapped=resolveWallDrawingSnap([4.7,0],[target],[0,0],true,false);
    expect(snapped.endpoint?.point).toEqual([5,0]);expect(snapped.point).toEqual([5,0]);
    expect(resolveWallDrawingSnap([4,0],[target],[0,0],true,false).nearEndpoint).toBeUndefined();
    expect(resolveWallDrawingSnap([4.4,0],[target],[0,0],false,false).nearEndpoint).toBeUndefined();
  });
  it('highlights the correct moving endpoint before a whole-wall snap without moving early',()=>{
    const source=wall('source',[0,0],[4,0]),target=wall('target',[7,0],[7,5]);
    const approaching=resolveWallDrag(source,'move',[2.4,.1],[target],true,true);
    expect(approaching.wall.start).toEqual([2.5,0]);expect(approaching.wall.end).toEqual([6.5,0]);
    expect(approaching.feedback?.point).toEqual([6.5,0]);expect(approaching.feedback?.origin).toEqual([4,0]);
    expect(approaching.feedback?.nearEndpoint?.point).toEqual([7,0]);expect(approaching.feedback?.endpoint).toBeUndefined();
    const snapped=resolveWallDrag(source,'move',[2.7,.1],[target],true,true);
    expect(snapped.wall.end).toEqual([7,0]);expect(snapped.feedback?.endpoint?.point).toEqual([7,0]);
  });
  it('never advertises an off-axis, hidden or following endpoint as a nearby target',()=>{
    const source=wall('source',[0,0],[4,0]),offset=wall('offset',[7,.1],[7,5]);
    expect(resolveWallDrag(source,'move',[2.4,0],[offset],true,true).feedback?.nearEndpoint).toBeUndefined();
    expect(resolveWallDrawingSnap([6.4,0],[offset],[0,0],true,true).nearEndpoint).toBeUndefined();
    expect(resolveWallDrawingSnap([6.4,0],[{...offset,visible:false}],[0,0],true,false).nearEndpoint).toBeUndefined();
    expect(resolveWallDrag(source,'move',[.6,0],[wall('following',[4,0],[4,5])],true,false).feedback?.nearEndpoint).toBeUndefined();
  });
  it('locks either direction with snapping off, retaining an off-grid anchor',()=>{
    expect(resolveWallDrawingSnap([8,2],[],[.13,.17],false,true)).toMatchObject({point:[8,.17],axis:0});
    expect(resolveWallDrawingSnap([1,-8],[],[.13,.17],false,true)).toMatchObject({point:[.13,-8],axis:1});
    expect(resolveWallDrawingSnap([8,2],[],[.13,.17],false,false).point).toEqual([8,2]);
  });
  it('only shows endpoint feedback for the exact point that will be committed',()=>{
    const host=wall('host',[5.13,0],[5.13,5]);
    const snap=resolveWallDrawingSnap([5.05,.1],[host],[0,0],true,false);
    expect(snap.point).toEqual(host.start);expect(snap.endpoint).toMatchObject({wallId:'host',end:'start',point:host.start});
    expect(resolveWallDrawingSnap([5.05,.1],[host],[0,0],false,false).endpoint).toBeUndefined();
  });
  it('keeps axis locking stronger than an off-axis endpoint or wall projection',()=>{
    const host=wall('host',[5,.15],[8,3]);
    const snap=resolveWallDrawingSnap([5.1,.1],[host],[.13,.17],true,true);
    expect(snap.point[1]).toBe(.17);expect(snap.endpoint).toBeUndefined();
  });
  it('snaps along the constrained axis to off-grid endpoints and draft closure corners',()=>{
    const host=wall('host',[5.13,.17],[5.13,5]);
    expect(resolveWallDrawingSnap([5.1,.3],[host],[.13,.17],true,true).point).toEqual(host.start);
    expect(resolveWallDrawingSnap([.1,.1],[],[0,5],true,true,[[0,0],[5,0]]).endpoint?.point).toEqual([0,0]);
  });
  it('keeps existing wall-interior snapping without presenting it as an endpoint',()=>{
    const snap=resolveWallDrawingSnap([2.1,.2],[wall('host',[0,0],[8,0])],[2,5],true,false);
    expect(snap.point).toEqual([2,0]);expect(snap.endpoint).toBeUndefined();
  });
  it('does not use hidden targets or circular-wall seams as endpoints',()=>{
    const hidden={...wall('hidden',[5,0],[5,5]),visible:false};
    expect(resolveWallDrawingSnap([5.1,.1],[hidden],[0,0],true,false).endpoint).toBeUndefined();
    const circle={...wall('circle',[5,0],[5,0]),curve:{center:[0,0] as [number,number],radius:5,startAngle:0,sweepAngle:360}};
    expect(resolveWallDrawingSnap([5.1,.1],[circle],undefined,true,false).endpoint).toBeUndefined();
  });
  it('uses floor-local axes for rotated storeys',()=>{
    const rotated={...level,position:[10,7,-8] as [number,number,number],rotation:90};
    const hit=drawingPoint(rotated,12,-12);
    expect(resolveWallDrawingSnap(hit,[],[0,0],false,true).point).toEqual([4,0]);
  });
  it('moves an entire off-grid wall along one axis without changing its length',()=>{
    const source=wall('source',[.13,.17],[4.13,2.17]);
    const result=resolveWallDrag(source,'move',[2.12,.8],[],true,true);
    expect(result.wall.start).toEqual([2.13,.17]);expect(result.wall.end).toEqual([6.13,2.17]);
    expect(result.feedback?.axis).toBe(0);
  });
  it('locks endpoint edits relative to the opposite end and releases without residual constraint',()=>{
    const source=wall('source',[.13,.17],[4.13,2.17]);
    expect(resolveWallDrag(source,'end',[2,.5],[],false,true).wall.end).toEqual([6.13,.17]);
    expect(resolveWallDrag(source,'end',[2,.5],[],false,false).wall.end).toEqual([6.13,2.67]);
  });
  it('snaps either translated endpoint with one common delta',()=>{
    const source=wall('source',[0,0],[4,0]),host=wall('host',[7.13,2.17],[7.13,6]);
    const result=resolveWallDrag(source,'move',[3.05,2.1],[source,host],true,false);
    expect(result.wall.end).toEqual(host.start);expect(result.wall.start).toEqual([3.13,2.17]);
    expect(result.feedback?.endpoint?.wallId).toBe('host');
  });
  it('does not snap to a following corner, another level or an off-axis endpoint',()=>{
    const source=wall('source',[0,0],[4,0]);
    const neighbor=wall('neighbor',[4,0],[4,5]);
    expect(resolveWallDrag(source,'move',[.2,0],[neighbor],true,false).feedback?.endpoint).toBeUndefined();
    const other={...wall('other',[6,0],[6,5]),parentId:'elsewhere'};
    expect(resolveWallDrag(source,'end',[2.1,0],[other],true,false).feedback?.endpoint).toBeUndefined();
    expect(resolveWallDrag(source,'end',[2.1,.1],[wall('offset',[6,.1],[6,5])],true,true).wall.end[1]).toBe(0);
  });
  it('commits exact drawing coordinates with one undo entry and portable reopening',()=>{
    const host=wall('host',[5.13,.17],[5.13,5]);
    const project=parseProject({...createSite({name:'Snaps',width:40,depth:40,resolution:129,preset:'flat'}),entities:[level,host]});
    const point=resolveWallDrawingSnap([5.1,.3],[host],[.13,.17],true,true).point;
    const editor=new Editor(project);
    editor.execute({type:'insert',entities:createWallChain(project,level.id,[[.13,.17],point],false,'new',false)},'Draw wall');
    expect((editor.getSnapshot().project.entities.find(e=>e.id==='new-0') as Wall).end).toEqual(point);
    const after=editor.getSnapshot().project;
    expect(deserializeProject(serializeProject(after))).toEqual(after);
    editor.undo();expect(editor.getSnapshot().project).toEqual(project);
    editor.redo();expect(editor.getSnapshot().project).toEqual(after);
  });
  it('ignores T-junction endpoints that follow the moving host',()=>{
    const source=wall('source',[0,0],[4,0]);
    const branch={...wall('branch',[2,0],[2,5]),junctions:{start:'source'}};
    expect(resolveWallDrag(source,'move',[1.9,.1],[branch],true,false).feedback?.endpoint).toBeUndefined();
  });
  it('snaps a dragged endpoint exactly without moving the opposite end',()=>{
    const source=wall('source',[0,0],[4,0]),host=wall('host',[6.13,0],[6.13,5]);
    const result=resolveWallDrag(source,'end',[2.1,.2],[host],true,true);
    expect(result.wall.start).toEqual(source.start);expect(result.wall.end).toEqual(host.start);
    expect(result.feedback?.endpoint?.point).toEqual(result.wall.end);
  });
  it('keeps validation when a snap would collapse a wall or clip an opening',()=>{
    const source={...wall('source',[0,0],[4,0]),openings:[{id:'window',kind:'window' as const,offset:2,width:1,height:1,sill:1}]};
    expect(()=>resolveWallDrag(source,'end',[-2,0],[wall('target',[2,0],[2,5])],true,true)).toThrow('opening');
    expect(()=>resolveWallDrag(wall('source',[0,0],[4,0]),'end',[-4,0],[],true,true)).toThrow();
  });
  it('retains joined-corner propagation, cancellation and a single undo step while toggling Shift',()=>{
    const source=wall('source',[0,0],[4,0]),neighbor=wall('neighbor',[4,0],[4,5]);
    const project=parseProject({...createSite({name:'Snaps',width:40,depth:40,resolution:129,preset:'flat'}),entities:[level,source,neighbor]});
    const editor=new Editor(project);
    editor.begin('Move wall');
    for(const shift of [false,true,false,true])editor.preview({type:'replace',entity:resolveWallDrag(source,'move',[1,.2],[source,neighbor],true,shift).wall});
    expect(editor.getSnapshot().past).toHaveLength(0);
    expect((editor.getSnapshot().preview!.entities.find(e=>e.id==='neighbor') as Wall).start).toEqual([5,0]);
    editor.cancel();expect(editor.getSnapshot().project).toEqual(project);
    editor.begin('Move wall');editor.preview({type:'replace',entity:resolveWallDrag(source,'move',[1,.2],[source,neighbor],true,true).wall});editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(project);
  });
});
