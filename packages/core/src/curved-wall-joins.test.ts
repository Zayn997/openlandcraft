import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject} from '@openlandcraft/project';
import {architectureIssue,applyCommand,connectCurvedWall,copySelection,createCurvedWall,createSite,createWallChain,curveBoundary,dragWall,Editor,mixedWallCap,parseProject,pasteSelection,snapCurveDrawingPoint,snapWallPoint,updateCurvedWall,wallFootprint,wallPathPoint,type Level,type Wall,type PlanPoint} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[8,3,-6],rotation:37};
const ring=()=>createCurvedWall(level.id,'circle',[[0,0],[5,0]],.8,4,false,.2,'ring');
const scene=(...walls:Wall[])=>parseProject({...createSite({name:'Mixed joins',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...walls]});
const get=(p:ReturnType<typeof scene>,id:string)=>p.entities.find((e):e is Wall=>e.id===id&&e.kind==='wall')!;
const branch=(host=ring(),points:PlanPoint[]=[[10,0],[5,0]],thickness=.2)=>createWallChain(scene(host),level.id,points,false,'branch',false,thickness)[0];
const arc=()=>createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.25,4,false,.2,'arc');

describe('editable mixed straight/curved wall joins',()=>{
  it('snaps to a circular host at its seam and elsewhere without inventing circle endpoints',()=>{
    const host=ring();expect(snapWallPoint([5.2,.05],[host])[0]).toBeLessThanOrEqual(5);
    const p=snapWallPoint([.06,5.15],[host]);expect(Math.hypot(...p)).toBeCloseTo(5);
    const unattached={...branch(host),junctions:undefined};expect(wallFootprint(unattached,[host,unattached]).map(p=>p[0])).toEqual([0,5,5,0]);
    for(const end of ['start','end'] as const){const points:PlanPoint[]=end==='end'?[[10,0],[5,0]]:[[5,0],[10,0]],w=branch(host,points);expect(w.junctions?.[end]).toBe(host.id);expect(architectureIssue([host,w])).toBeNull();}
  });
  it('joins thin/thick straight branches on either circular face while preserving each authored wall',()=>{
    for(const thickness of [.15,.6,1.2])for(const inside of [false,true]){
      const host=ring(),w=branch(host,inside?[[0,0],[5,0]]:[[10,0],[5,0]],thickness),editor=new Editor(scene(host));editor.execute({type:'add',entity:w},'Join');
      expect(get(editor.getSnapshot().project,host.id)).toEqual(host);expect(get(editor.getSnapshot().project,w.id).thickness).toBe(thickness);expect(w.height).toBe(host.height);
      const cap=mixedWallCap(w,'end',0,[host,w])!;expect(cap[0]).toBeCloseTo(inside?4.6:5.4,6);expect(cap[1]).toBeCloseTo(0,6);
      expect(editor.getSnapshot().project.entities.filter(e=>e.kind==='wall')).toHaveLength(2);
    }
  });
  it('gives endpoint joins shared cap vertices for both directions and unequal thicknesses',()=>{
    for(const reverse of [false,true]){
      const a=arc(),b:Wall={id:'straight',kind:'wall',name:'Curtain',parentId:level.id,visible:true,color:a.color,joins:true,start:reverse?[0,10]:a.end,end:reverse?a.end:[0,10],height:4,thickness:.8,elevation:.2};
      expect(architectureIssue([a,b])).toBeNull();
      const ca=[-.125,.125].map(s=>mixedWallCap(a,'end',s,[a,b])!),cb=[-.4,.4].map(s=>mixedWallCap(b,reverse?'end':'start',s,[a,b])!);
      expect(ca.every(p=>cb.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-8))).toBe(true);
      const boundary=curveBoundary(a,-.125,[a,b]);expect(boundary.at(-1)).toEqual(ca[0]);
    }
  });
  it('connects an arc endpoint to a straight host, inherits its profile, and protects its openings',()=>{
    const host:Wall={...branch(),id:'host',start:[-8,0],end:[8,0],height:6,elevation:1,junctions:undefined,thickness:.5};
    const a=connectCurvedWall(scene(host),arc());expect(a.junctions).toEqual({start:'host'});expect(a.height).toBe(6);expect(a.elevation).toBe(1);expect(architectureIssue([host,a])).toBeNull();
    const opened={...host,openings:[{id:'door',kind:'door' as const,offset:12.5,width:1,height:2,sill:0}]};
    expect(()=>applyCommand(scene(opened),{type:'add',entity:a})).toThrow('door or window');
    expect(snapCurveDrawingPoint([.1,5],[[0,0],[5,0]],[{...host,start:[0,1],end:[0,8]}],true)[0]).toBeCloseTo(0);
  });
  it('carries straight attachments through circle radius/center and connected profile edits, undo and reopening',()=>{
    const host=ring(),w=branch(host),editor=new Editor(scene(host,w)),before=editor.getSnapshot().project;
    const changed={...updateCurvedWall(host,{radius:6,center:[1,2]}),height:7,thickness:1.1};editor.execute({type:'replace',entity:changed},'Resize tower');
    const after=editor.getSnapshot().project,moved=get(after,w.id);expect(moved.end[0]).toBeCloseTo(7);expect(moved.end[1]).toBeCloseTo(2);expect(moved.start).toEqual(w.start);expect(moved.thickness).toBe(.2);expect(moved.height).toBe(7);expect(moved.junctions?.end).toBe(host.id);
    expect(deserializeProject(serializeProject(after))).toEqual(after);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(editor.getSnapshot().project).toEqual(after);
  });
  it('keeps arc/straight shared corners editable from either side without leaving stale curve endpoints',()=>{
    const a=arc(),b:Wall={...branch(),id:'straight',start:a.end,end:[0,10],junctions:undefined,thickness:.8},editor=new Editor(scene(a,b));
    editor.execute({type:'replace',entity:updateCurvedWall(a,{radius:6})},'Radius');expect(get(editor.getSnapshot().project,b.id).start[1]).toBeCloseTo(6);
    const straight=get(editor.getSnapshot().project,b.id);editor.execute({type:'replace',entity:dragWall(straight,'start',[1,0],false)},'Move corner');
    const curved=get(editor.getSnapshot().project,a.id),line=get(editor.getSnapshot().project,b.id);expect(curved.curve!.sweepAngle).toBe(90);expect(curved.end[0]).toBeCloseTo(line.start[0]);expect(curved.end[1]).toBeCloseTo(line.start[1]);expect(architectureIssue(editor.getSnapshot().project.entities)).toBeNull();
  });
  it('supports two attachments, circles with rotated seams, and both clockwise arc directions',()=>{
    const host=updateCurvedWall(ring(),{startAngle:137}),east=branch(host),north=createWallChain(scene(host),level.id,[[0,10],[0,5]],false,'north',false,.35)[0],editor=new Editor(scene(host,east,north));
    editor.execute({type:'replace',entity:updateCurvedWall(host,{radius:7})},'Radius');expect(get(editor.getSnapshot().project,east.id).end[0]).toBeCloseTo(7);expect(get(editor.getSnapshot().project,north.id).end[1]).toBeCloseTo(7);
    for(const clockwise of [false,true]){const a=createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.4,4,clockwise),end=wallPathPoint(a,.5),d=wallPathPoint(a,.5,-4),w=createWallChain(scene(a),level.id,[d,end],false,'p',false,.15)[0];expect(architectureIssue([a,w])).toBeNull();}
  });
  it('detaches moved/deleted/unjoined hosts deliberately and remaps copied networks',()=>{
    const host=ring(),w=branch(host),p=scene(host,w),editor=new Editor(p);
    editor.execute({type:'replace',entity:dragWall(w,'end',[1,0],false)},'Detach');expect(get(editor.getSnapshot().project,w.id).junctions).toBeUndefined();editor.undo();
    editor.execute({type:'remove',id:host.id},'Remove');expect(get(editor.getSnapshot().project,w.id).junctions).toBeUndefined();editor.undo();expect(editor.getSnapshot().project).toEqual(p);
    const copied=pasteSelection(p,copySelection(p,w.id,[host.id,w.id]),level.id,'copy').command,next=applyCommand(p,copied),copy=next.entities.find((e):e is Wall=>e.kind==='wall'&&e.name===w.name+' copy')!;
    expect(copy.junctions?.end).not.toBe(host.id);expect(architectureIssue(next.entities)).toBeNull();
    editor.execute({type:'replace',entity:{...host,joins:false}},'Unjoin');expect(get(editor.getSnapshot().project,w.id).junctions).toBeUndefined();
  });
  it('rejects crossings, acute/overlapping or collapsed joins atomically, and respects locked attachments',()=>{
    const host=ring();expect(()=>createWallChain(scene(host),level.id,[[-10,0],[10,0]],false,'cross',false)).toThrow('Crossing');
    const a=branch(host),nearby=createWallChain(scene(host),level.id,[[10,.1],[Math.sqrt(25-.01),.1]],false,'near',false,.2)[0];expect(architectureIssue([host,a,nearby])).toContain('overlap');
    const shallow=createWallChain(scene(host),level.id,[[5.3,4],[5,0]],false,'shallow',false,.2)[0];expect(architectureIssue([host,shallow])).toContain('30°');
    const editor=new Editor(scene(host,a)),before=editor.getSnapshot();expect(()=>editor.execute({type:'replace',entity:updateCurvedWall(host,{radius:.3})},'Invalid')).toThrow();expect(editor.getSnapshot()).toBe(before);
    const locked=scene(host,a);locked.layers.push({id:'locked',name:'Locked',parentId:null,visible:true,locked:true,color:'#333333'});locked.objectLayers[a.id]='locked';const e=new Editor(locked);expect(()=>e.execute({type:'replace',entity:updateCurvedWall(host,{radius:6})},'Locked')).toThrow('Unlock');
  });
});
