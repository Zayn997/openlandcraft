import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import 'fake-indexeddb/auto';
import {applyCommand,copySelection,createCurvedWall,createSite,createWallChain,curvePoint,curvedWallDistance,dragWall,duplicateAbove,Editor,openingAtPoint,parseProject,partBounds,pasteSelection,updateCurvedWall,wallLength,type Level,type Wall} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Tower level',visible:true,position:[10,5,-8],rotation:35};
const scene=()=>parseProject({...createSite({name:'Curves',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level]});
const circle=()=>createCurvedWall(level.id,'circle',[[0,0],[5,0]],0.4,4,false,0.2,'circle');

describe('native editable curved walls',()=>{
  it('creates a hollow circular wall as one authored entity with exact circumference',()=>{
    const wall=circle(),project=applyCommand(scene(),{type:'add',entity:wall});
    expect(project.entities.filter(e=>e.kind==='wall')).toEqual([wall]);expect(wall.curve).toEqual({center:[0,0],radius:5,startAngle:0,sweepAngle:360});
    expect(wallLength(wall)).toBeCloseTo(10*Math.PI);expect(wall.start[0]).toBeCloseTo(wall.end[0]);expect(wall.start[1]).toBeCloseTo(wall.end[1]);
  });
  it('draws counterclockwise and clockwise minor/major arcs across the angular seam',()=>{
    const point=(angle:number):[number,number]=>[5*Math.cos(angle*Math.PI/180),5*Math.sin(angle*Math.PI/180)];
    for(const [start,end,clockwise,sweep]of[[350,20,false,30],[20,350,true,-30],[0,90,true,-270],[0,90,false,90]] as const){
      const wall=createCurvedWall(level.id,'arc',[[0,0],point(start),point(end)],.3,3,clockwise);
      expect(wall.curve!.sweepAngle).toBeCloseTo(sweep);expect(wall.end[0]).toBeCloseTo(point(end)[0]);expect(wall.end[1]).toBeCloseTo(point(end)[1]);
      expect(()=>applyCommand(scene(),{type:'add',entity:wall})).not.toThrow();
    }
  });
  it('preserves radius/profile edits, independent identity, undo, portable and local reopening',async()=>{
    const editor=new Editor(scene()),wall=circle();editor.execute({type:'add',entity:wall},'Draw circle');
    const changed={...updateCurvedWall(wall,{radius:7,center:[3,-2]}),thickness:.8,height:8};
    editor.execute({type:'replace',entity:changed},'Edit circle');expect(editor.getSnapshot().past).toHaveLength(2);
    const saved=editor.getSnapshot().project;expect(deserializeProject(serializeProject(saved))).toEqual(saved);
    await saveLocal(saved);expect(await loadLocal()).toEqual(saved);
    editor.undo();expect(editor.getSnapshot().project.entities.find(e=>e.id===wall.id)).toEqual(wall);editor.redo();expect(editor.getSnapshot().project).toEqual(saved);
  });
  it('rejects zero arcs, collapsed inner radius, nonfinite dimensions and out-of-range moves atomically',()=>{
    expect(()=>createCurvedWall(level.id,'arc',[[0,0],[5,0],[5,0]],.3,3)).toThrow('at least');
    expect(()=>createCurvedWall(level.id,'circle',[[0,0],[.25,0]],1,3)).toThrow('radius');
    const editor=new Editor(applyCommand(scene(),{type:'add',entity:circle()})),before=editor.getSnapshot();
    for(const bad of [updateCurvedWall(circle(),{radius:.25}),updateCurvedWall(circle(),{center:[98,0]}),updateCurvedWall(circle(),{sweepAngle:0}),{...circle(),height:NaN},{...circle(),start:[0,0] as [number,number]}]){
      expect(()=>editor.execute({type:'replace',entity:bad},'Invalid')).toThrow();expect(editor.getSnapshot()).toBe(before);
    }
    expect(()=>dragWall(circle(),'move',[100,0],false)).toThrow();
  });
  it('moves and resizes from the original pointer state; start/end drags preserve the radius',()=>{
    const wall=circle(),moved=dragWall(wall,'move',[1.13,-.6],true),resized=dragWall(wall,'radius',[-2,0],false);
    expect(moved.curve!.center).toEqual([1.25,-.5]);expect(moved.curve!.radius).toBe(5);expect(resized.curve!.radius).toBeCloseTo(7);
    const snapped=dragWall(wall,'radius',[-1.31,.19],true);expect(snapped.curve!.radius*4).toBe(Math.round(snapped.curve!.radius*4));
    const arc=createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.4,4),end=dragWall(arc,'end',[-5,0],false);
    expect(end.curve!.radius).toBe(5);expect(()=>dragWall(arc,'end',[5,-5],false)).toThrow();
  });
  it('copies a wall in rotated-level coordinates and duplicates levels without changing local curves',()=>{
    const wall=circle(),project=applyCommand(scene(),{type:'add',entity:wall});
    const result=pasteSelection(project,copySelection(project,wall.id),wall.id,'copy',0,{worldDelta:[3,2],snapping:false});
    const next=applyCommand(project,result.command),copy=next.entities.find(e=>e.id===result.selectedIds[0]) as Wall,angle=level.rotation*Math.PI/180;
    expect(copy.curve!.center[0]).toBeCloseTo(3*Math.cos(angle)-2*Math.sin(angle));expect(copy.curve!.center[1]).toBeCloseTo(3*Math.sin(angle)+2*Math.cos(angle));
    expect(copy.start).toEqual(curvePoint(copy.curve!,0));expect(next.entities.find(e=>e.id===wall.id)).toEqual(wall);
    const upper=duplicateAbove(project,level.id,5,'upper').project.entities.find(e=>e.kind==='wall'&&e.id!==wall.id) as Wall;
    expect(upper.curve).toEqual(wall.curve);expect(upper.parentId).not.toBe(wall.parentId);
  });
  it('bounds and landscape clearance use the whole ring/arc rather than its endpoint chord',()=>{
    const wall=circle(),bounds=partBounds(wall,level);
    expect(bounds.min[0]).toBeCloseTo(4.8);expect(bounds.max[0]).toBeCloseTo(15.2);expect(bounds.min[2]).toBeCloseTo(-13.2);expect(bounds.max[2]).toBeCloseTo(-2.8);
    expect(curvedWallDistance(wall,[0,5])).toBeCloseTo(0);expect(curvedWallDistance(wall,[0,0])).toBe(5);
    const arc=createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.4,3);
    expect(curvedWallDistance(arc,[-5,0])).toBeCloseTo(Math.sqrt(50));
  });
  it('keeps straight-wall joins unchanged and places openings on curved walls',()=>{
    const wall=circle(),project=applyCommand(scene(),{type:'add',entity:wall});
    const straight=createWallChain(project,level.id,[[10,0],[15,0],[15,5]],false,'straight',false);
    expect(()=>applyCommand(project,{type:'insert',entities:straight})).not.toThrow();expect(wall.joins).toBe(true);
    expect(()=>applyCommand(project,{type:'replace',entity:{...wall,joins:false}})).not.toThrow();
    const hit=openingAtPoint(wall,level,[10,6,-3],{kind:'door',width:1,height:2,sill:0,snapping:false},'door');expect(hit.opening).not.toBeNull();expect(hit.issue).toBeNull();
  });
  it('upgrades version 18 without changing authored data and rejects new curves in old files',()=>{
    const legacy={...scene(),version:18},before=structuredClone(legacy),upgraded=parseProject(legacy);
    expect(upgraded).toEqual({...legacy,version:33});expect(legacy).toEqual(before);
    expect(()=>parseProject({...legacy,entities:[level,circle()]})).toThrow();
  });
});
