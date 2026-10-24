import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,loadLocal,saveLocal} from '@openlandcraft/project';
import {applyCommand,battlementLayout,conicalRoofForTower,copySelection,createCurvedWall,createSite,createWallChain,DEFAULT_BATTLEMENTS,duplicateAbove,Editor,parseProject,partBounds,pasteSelection,updateCurvedWall,type Entity,type Level,type Wall} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[0,3,0],rotation:25};
const circle=():Wall=>({...createCurvedWall('level','circle',[[0,0],[5,0]],.6,6,false,1,'tower'),battlements:{...DEFAULT_BATTLEMENTS},openings:[{id:'gate',kind:'door',width:2,height:3,sill:0,offset:3,shape:'arch',archRise:1}]});
const straight=():Wall=>({id:'straight',kind:'wall',parentId:'level',name:'Curtain',visible:true,color:'#eeeeee',start:[-5,-12],end:[5,-12],height:6,thickness:.4,elevation:1,battlements:{width:1,height:1.2,spacing:1}});
const scene=(...entities:Entity[])=>parseProject({...createSite({name:'Battlements',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...entities]});
const getWall=(p:ReturnType<typeof scene>,id='tower')=>p.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===id)!;

describe('editable wall-owned battlements',()=>{
  it('closes circular patterns with one equal seam gap and preserves authored block sizes',()=>{
    for(const clockwise of [false,true]){
      const w=circle();if(clockwise)w.curve!.sweepAngle=-360;
      const layout=battlementLayout(w),length=2*Math.PI*5;
      expect(layout.count).toBe(15);expect(layout.gap).toBeGreaterThanOrEqual(1);
      for(let i=0;i<layout.count;i++){const [a,b]=layout.spans[i];expect(b-a).toBeCloseTo(1);const next=layout.spans[(i+1)%layout.count][0]+(i===layout.count-1?length:0);expect(next-b).toBeCloseTo(layout.gap);}
    }
  });
  it('centers straight and arc patterns with the requested clear gap and handles short walls',()=>{
    const w=straight(),layout=battlementLayout(w);expect(layout.count).toBe(5);expect(layout.spans[0][0]).toBeCloseTo(.5);expect(layout.spans[4][1]).toBeCloseTo(9.5);expect(layout.gap).toBe(1);
    const arc={...circle(),curve:{...circle().curve!,sweepAngle:180},end:[-5,0] as [number,number]};expect(battlementLayout(arc).gap).toBe(1);
    expect(battlementLayout({...w,end:[-4.5,-12]}).count).toBe(0);
  });
  it('regenerates ring count on radius edits and follows profile, center and thickness without changing the pattern',()=>{
    const w=circle(),r=conicalRoofForTower(w,4,.5,'roof'),editor=new Editor(scene(w,r));
    editor.execute({type:'replace',entity:{...updateCurvedWall(w,{radius:7,center:[2,1]}),height:9,elevation:2,thickness:1}},'Resize tower');
    const next=getWall(editor.getSnapshot().project);expect(next.battlements).toEqual(w.battlements);expect(battlementLayout(next).count).toBe(21);expect(next.openings![0].id).toBe('gate');
    const roof=editor.getSnapshot().project.entities.find(e=>e.id==='roof');expect(roof?.kind==='roof'&&roof.elevation).toBe(11);expect(partBounds(next,level).max[1]).toBe(15);
  });
  it('keeps straight patterns independent while joined height changes propagate',()=>{
    const w=circle(),p=scene(w),branch={...createWallChain(p,'level',[[10,0],[5,0]],false,'branch',false,.3)[0],battlements:{width:.5,height:.7,spacing:.5}},editor=new Editor(scene(w,branch));
    editor.execute({type:'replace',entity:{...branch,height:8}},'Height');const next=editor.getSnapshot().project;expect(getWall(next).height).toBe(8);expect(getWall(next).battlements).toEqual(w.battlements);expect(getWall(next,branch.id).battlements).toEqual(branch.battlements);
    const curtain=straight(),before=battlementLayout(curtain).count;expect(battlementLayout({...curtain,end:[10,-12]}).count).toBeGreaterThan(before);
  });
  it('uses one preview/commit history action and retains opening IDs on remove and undo',()=>{
    const w=circle(),editor=new Editor(scene(w)),before=editor.getSnapshot().project;
    const next={...w,battlements:{width:1.5,height:2,spacing:.8}};editor.begin('Battlements');editor.preview({type:'replace',entity:next});expect(getWall(editor.getSnapshot().preview!).battlements!.height).toBe(2);editor.cancel();expect(editor.getSnapshot().project).toBe(before);
    editor.execute({type:'replace',entity:next},'Battlements');expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();
    editor.execute({type:'replace',entity:{...getWall(editor.getSnapshot().project),battlements:undefined}},'Remove');expect(getWall(editor.getSnapshot().project).battlements).toBeUndefined();expect(getWall(editor.getSnapshot().project).openings).toEqual(w.openings);editor.undo();expect(getWall(editor.getSnapshot().project).battlements).toEqual(next.battlements);
  });
  it('rejects invalid dimensions, impossible shrinking, excessive counts and locked edits atomically',()=>{
    const w=circle(),editor=new Editor(scene(w)),before=editor.getSnapshot();
    for(const b of [{width:0,height:1,spacing:1},{width:1,height:NaN,spacing:1},{width:1,height:1,spacing:-1},{width:1,height:6,spacing:1}])expect(()=>editor.execute({type:'replace',entity:{...w,battlements:b}},'Invalid')).toThrow();
    expect(editor.getSnapshot()).toBe(before);
    const big={...createCurvedWall('level','circle',[[0,0],[90,0]],.4,5,false,0,'big'),battlements:{width:.1,height:1,spacing:.1}};expect(()=>scene(big)).toThrow('512');
    const short=straight(),shortEditor=new Editor(scene(short));expect(()=>shortEditor.execute({type:'replace',entity:{...short,end:[-4.5,-12]}},'Shrink')).toThrow('too short');
    const p=scene(w);p.layers[0].locked=true;expect(()=>applyCommand(p,{type:'replace',entity:{...w,battlements:undefined}})).toThrow('Unlock');
  });
  it('copies and duplicates wall patterns without creating individual merlon entities',()=>{
    const p=scene(circle()),clip=copySelection(p,'tower'),copied=applyCommand(p,pasteSelection(p,clip,'level','copy').command),walls=copied.entities.filter((e):e is Wall=>e.kind==='wall');expect(walls).toHaveLength(2);expect(walls[1].battlements).toEqual(walls[0].battlements);
    const duplicated=duplicateAbove(p,'level',8,'upper');expect(getWall(duplicated.project,'upper-part-0').battlements).toEqual(circle().battlements);expect(duplicated.project.entities.filter(e=>e.kind==='wall')).toHaveLength(2);
  });
  it('migrates old files without adding patterns and round-trips authored patterns through both storage forms',async()=>{
    const w=circle(),p=scene(w),{battlements,...oldWall}=w,old={...p,version:22,entities:[level,oldWall]},snapshot=structuredClone(old);expect(parseProject(old).version).toBe(32);expect(parseProject(old).entities).toEqual([level,oldWall]);expect(old).toEqual(snapshot);
    expect(()=>parseProject({...old,entities:[level,w]})).toThrow();expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);
  });
});
