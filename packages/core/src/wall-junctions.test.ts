import { describe, expect, it } from 'vitest';
import { architectureIssue, copySelection, createSite, createWallChain, dragWall, duplicateAbove, Editor, parseProject, pasteSelection, snapWallPoint, wallFootprint, type Level, type PlanPoint, type Wall } from './index';
import { deserializeProject, serializeProject } from '@openlandcraft/project';

const level:Level={id:'level',kind:'level',name:'Ground',parentId:'site',position:[12,6,-9],rotation:37,visible:true};
const host:Wall={id:'host',kind:'wall',parentId:level.id,name:'Exterior',visible:true,joins:true,start:[-6,0],end:[6,0],thickness:0.4,height:3.2,elevation:0.2,color:'#dddddd',openings:[{id:'window',kind:'window',offset:1,width:1.2,height:1.2,sill:1}]};
const scene=()=>parseProject({...createSite({name:'Junctions',width:60,depth:60,resolution:129,preset:'flat'}),entities:[level,host]});
const branch=(p=scene(),points:PlanPoint[]=[[0,4],[0,0]],thickness=0.15)=>createWallChain(p,level.id,points,false,'partition',true,thickness)[0];
const wall=(p:ReturnType<typeof scene>,id:string)=>p.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===id)!;

describe('editable wall junctions',()=>{
  it('snaps onto a wall face and creates an explicit T host without splitting or modifying that host',()=>{
    expect(snapWallPoint([0,0.25],[host])).toEqual([0,0]);
    expect(snapWallPoint([0.08,0.25],[host],[0,4])).toEqual([0,0]);
    const p=scene(),w=branch(p),editor=new Editor(p);
    editor.execute({type:'add',entity:w},'Draw partition');
    expect(w.junctions).toEqual({end:'host'});expect(w.thickness).toBe(0.15);
    expect(wall(editor.getSnapshot().project,'host')).toEqual(host);
    expect(editor.getSnapshot().project.entities.filter(e=>e.kind==='wall')).toHaveLength(2);
    expect(editor.getSnapshot().past).toHaveLength(1);
    const result=editor.getSnapshot().project;
    editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();expect(editor.getSnapshot().project).toEqual(result);
    expect(deserializeProject(serializeProject(result))).toEqual(result);
  });
  it('trims the branch to the correct host face for reversed direction, either side and oblique connections',()=>{
    for(const angle of [Math.PI/2,Math.PI/3,Math.PI*2/3,-Math.PI/2])for(const reverse of [false,true]) {
      const away:PlanPoint=[4*Math.cos(angle),4*Math.sin(angle)],points:PlanPoint[]=reverse?[[0,0],away]:[away,[0,0]];
      const w=branch(scene(),points),polygon=wallFootprint(w,[host,w]);
      expect(architectureIssue([host,w])).toBeNull();
      const cap=reverse?[polygon[0],polygon[3]]:[polygon[1],polygon[2]];
      const length=Math.hypot(w.end[0]-w.start[0],w.end[1]-w.start[1]),dx=(w.end[0]-w.start[0])/length,dz=(w.end[1]-w.start[1])/length;
      for(const [x,y] of cap)expect(w.start[1]+dz*x+dx*y).toBeCloseTo(Math.sign(away[1])*host.thickness/2,8);
    }
  });
  it('moves a host and carries its branch endpoints, preserving thicknesses and opening IDs through undo',()=>{
    const p=scene(),w=branch(p),editor=new Editor(parseProject({...p,entities:[...p.entities,w]}));
    const before=editor.getSnapshot().project;
    editor.begin('Move host');editor.preview({type:'replace',entity:dragWall(host,'move',[0,1],false)});
    expect(wall(editor.getSnapshot().preview!,w.id).end).toEqual([0,1]);
    expect(wall(editor.getSnapshot().preview!,w.id).start).toEqual([0,4]);
    editor.commit();expect(wall(editor.getSnapshot().project,host.id).openings).toEqual(host.openings);
    editor.execute({type:'replace',entity:{...wall(editor.getSnapshot().project,host.id),thickness:0.45}},'Thicker exterior');
    expect(wall(editor.getSnapshot().project,w.id).thickness).toBe(0.15);
    editor.undo();editor.undo();expect(editor.getSnapshot().project).toEqual(before);
  });
  it('allows a branch to slide on its host and detaches when deliberately moved away',()=>{
    const p=scene(),w=branch(p),editor=new Editor(parseProject({...p,entities:[...p.entities,w]}));
    editor.execute({type:'replace',entity:dragWall(w,'end',[1,0],false)},'Slide');
    expect(wall(editor.getSnapshot().project,w.id).junctions?.end).toBe(host.id);
    editor.execute({type:'replace',entity:dragWall(wall(editor.getSnapshot().project,w.id),'end',[0,1],false)},'Detach');
    expect(wall(editor.getSnapshot().project,w.id).junctions).toBeUndefined();
    expect(wall(editor.getSnapshot().project,host.id)).toEqual(host);
  });
  it('rejects connections through hosted openings and openings added across an existing junction atomically',()=>{
    const p=scene(),editor=new Editor(p),before=editor.getSnapshot();
    expect(()=>editor.execute({type:'add',entity:branch(p,[[-4.5,4],[-4.5,0]])},'Invalid junction')).toThrow('door or window');
    expect(editor.getSnapshot()).toBe(before);
    const w=branch(p);editor.execute({type:'add',entity:w},'Partition');const valid=editor.getSnapshot();
    expect(()=>editor.execute({type:'replace',entity:{...host,openings:[{id:'door',kind:'door',offset:5.5,width:1,height:2.1,sill:0}]}},'Invalid door')).toThrow('door or window');
    expect(editor.getSnapshot()).toBe(valid);
  });
  it('rejects overlapping/crossing drafts and unsupported acute joins without inserting anything',()=>{
    const p=scene();
    expect(()=>branch(p,[[-2,0],[2,0]])).toThrow('overlaps');
    expect(()=>branch(p,[[0,-3],[0,3]])).toThrow('Crossing');
    const w=branch(p,[[4,1],[0,0]]);
    expect(architectureIssue([host,w])).toContain('30°');
  });
  it('deletes a host without deleting the partition and undo restores the connection',()=>{
    const p=scene(),w=branch(p),editor=new Editor(parseProject({...p,entities:[...p.entities,w]})),before=editor.getSnapshot().project;
    editor.execute({type:'remove',id:host.id},'Delete exterior');
    expect(wall(editor.getSnapshot().project,w.id).junctions).toBeUndefined();
    editor.undo();expect(editor.getSnapshot().project).toEqual(before);
  });
  it('keeps connections clear of host corners and neighboring connections on the same face',()=>{
    const p=scene(),first=branch(p,[[0,4],[0,0]],0.4);
    const nearby={...branch(p,[[0.25,4],[0.25,0]],0.4),id:'nearby'};
    expect(architectureIssue([host,first,nearby])).toContain('connections overlap');
    const opposite={...branch(p,[[1,-4],[0.25,0]],0.4),id:'opposite'};
    expect(architectureIssue([host,first,opposite])).toBeNull();
    const corner=createWallChain(p,level.id,[[5.95,4],[5.95,0]],false,'corner',false,0.4)[0];
    expect(architectureIssue([host,corner])).toContain('farther from the host corner');
  });
  it('keeps both ends attached when editing connected hosts',()=>{
    const p=scene(),a:Wall={...host,start:[0,0],end:[6,0],openings:[]},b:Wall={...a,id:'second-host',start:[6,0],end:[6,6]};
    const base=parseProject({...p,entities:[level,a,b]});
    const partition=createWallChain(base,level.id,[[3,0],[6,3]],false,'diagonal',false,0.15)[0];
    const editor=new Editor(parseProject({...base,entities:[...base.entities,partition]}));
    editor.execute({type:'replace',entity:dragWall(a,'move',[0,1],false)},'Move joined hosts');
    const moved=wall(editor.getSnapshot().project,partition.id);
    expect(moved.start).toEqual([3,1]);expect(moved.end).toEqual([6,3.5]);
    expect(moved.junctions).toEqual({start:a.id,end:b.id});
  });
  it('remaps hosts in copied floors and copied assemblies; a partition-only copy detaches',()=>{
    const p=scene(),w=branch(p),joined=parseProject({...p,entities:[...p.entities,w]});
    const repeated=duplicateAbove(joined,level.id,3.4,'upper').project;
    const copied=repeated.entities.find((e):e is Wall=>e.kind==='wall'&&e.id!==w.id&&e.name===w.name)!;
    expect(copied.junctions?.end).not.toBe(host.id);
    expect(wall(repeated,copied.junctions!.end!).parentId).toBe(copied.parentId);
    expect(()=>parseProject(repeated)).not.toThrow();
    for(const ids of [[host.id,w.id],[w.id]]) {
      const clipboard=copySelection(joined,w.id,ids)!;
      const pasted=pasteSelection(joined,clipboard,level.id,'paste',1).command;
      const editor=new Editor(joined);editor.execute(pasted,'Paste');
      const copy=editor.getSnapshot().project.entities.find((e):e is Wall=>e.kind==='wall'&&e.id!==w.id&&e.name===w.name+' copy')!;
      if(ids.length===2)expect(copy.junctions?.end).toBeTruthy();else expect(copy.junctions).toBeUndefined();
    }
  });
  it('migrates version 14 without inventing T joins in old overlapping geometry',()=>{
    const p=scene(),w={...branch(p),junctions:undefined};delete w.junctions;
    const old={...p,version:14,entities:[...p.entities,w]},snapshot=structuredClone(old);
    const migrated=parseProject(old);expect(migrated.version).toBe(39);expect(migrated.entities).toEqual(old.entities);expect(old).toEqual(snapshot);
    expect(wall(migrated,w.id).junctions).toBeUndefined();
    expect(()=>parseProject({...p,entities:[...p.entities,{...w,junctions:{end:'missing'}}]})).toThrow('junction');
  });
});
