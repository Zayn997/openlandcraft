import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {applyCommand,copySelection,createSite,createStairs,defaultWallWalk,duplicateAbove,Editor,parseProject,partBounds,pasteSelection,railingRuns,updateCurvedWall,updateStairs,wallRailingLength,wallWalkProfile,type Entity,type Level,type Slab,type Wall} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[4,3,-6],rotation:31,storeyHeight:4};
const railing={height:1.2,spacing:1.5};
const flight=():Slab=>{const s=createStairs('level',[0,0],[1,0],{width:2,rise:3,run:6,steps:12},1,false,'stairs');return {...s,stairs:{...s.stairs!,railings:{...railing,side:'both'}}};};
const wall=():Wall=>{const w:Wall={id:'wall',kind:'wall',parentId:'level',name:'Wall',visible:true,color:'#998877',start:[0,0],end:[12,0],height:6,thickness:.5,elevation:1};return {...w,walk:{...defaultWallWalk(w),railings:{...railing}}};};
const circle=():Wall=>updateCurvedWall({...wall(),curve:{center:[0,0],radius:7,startAngle:20,sweepAngle:360}},{radius:7});
const scene=(...entities:Entity[])=>parseProject({...createSite({name:'Railings',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...entities]});
const distance=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[2]-b[2]);

describe('hosted editable railings',()=>{
  it('anchors stair posts on treads, keeps both ends and honors maximum plan spacing',()=>{
    const s=flight(),runs=railingRuns(s);expect(runs).toHaveLength(2);
    for(const run of runs){expect(run.closed).toBe(false);expect(run.posts[0].base[0]).toBeCloseTo(.02);expect(run.posts.at(-1)!.base[0]).toBeCloseTo(5.98);
      for(const p of run.posts){expect(p.base[1]).toBeCloseTo(1+(Math.floor(p.base[0]/.5)+1)*.25);expect(p.top[1]-p.base[1]).toBeGreaterThanOrEqual(1.2-1e-8);expect(Math.abs(p.base[2])).toBeCloseTo(.98);}
      for(let i=1;i<run.posts.length;i++)expect(distance(run.posts[i-1].base,run.posts[i].base)).toBeLessThanOrEqual(1.5+1e-8);
    }
  });
  it('regenerates selected sides after width, rise, run, count, direction and base edits',()=>{
    const s=flight();s.stairs!.railings!.side='left';const next=updateStairs(s,{width:3,rise:4,run:8,steps:20,direction:90,elevation:2,start:[2,-3]}),run=railingRuns(next)[0];expect(railingRuns(next)).toHaveLength(1);expect(next.stairs!.railings).toEqual(s.stairs!.railings);
    expect(run.posts[0].base[0]).toBeCloseTo(.52);expect(run.posts[0].base[2]).toBeCloseTo(-2.98);expect(run.posts.at(-1)!.top[1]).toBeCloseTo(7.2);expect(partBounds(next,level).max[1]).toBeCloseTo(10.2);
    const single=updateStairs(s,{run:1,rise:.5,steps:1});expect(railingRuns(single)[0].posts.every(p=>p.base[1]===1.5)).toBe(true);const longTreads=updateStairs(s,{run:30,steps:2});const posts=railingRuns(longTreads)[0].posts;expect(posts.length).toBeGreaterThan(10);for(let i=1;i<posts.length;i++)expect(distance(posts[i-1].base,posts[i].base)).toBeLessThanOrEqual(1.5+1e-8);
  });
  it('follows straight walk side and curved walk radius, direction, width and wall height',()=>{
    const w=wall(),straight=railingRuns(w)[0];expect(straight.posts[0].base).toEqual([0,5.9,2.03]);w.walk!.side='right';expect(railingRuns(w)[0].posts[0].base[2]).toBeCloseTo(-2.03);
    for(const sweepAngle of [360,-360,150,-150]){
      const c=updateCurvedWall(circle(),{radius:9,sweepAngle});c.height=9;c.walk!.width=3;
      const run=railingRuns(c)[0],r=9-wallWalkProfile(c).inner+.02;expect(run.closed).toBe(Math.abs(sweepAngle)===360);
      for(const p of run.posts){expect(Math.hypot(p.base[0],p.base[2])).toBeCloseTo(r);expect(p.base[1]).toBeCloseTo(8.9);expect(p.top[1]).toBeCloseTo(10.1);}
      if(run.closed){expect(run.posts[0].base).not.toEqual(run.posts.at(-1)!.base);expect(run.top[0][0]).toBeCloseTo(run.top.at(-1)![0]);expect(wallRailingLength(c)/run.posts.length).toBeLessThanOrEqual(1.5);}
    }
  });
  it('leaves an access gap with fixed width and proportional position through radius changes, including a seam crossing',()=>{
    const c=circle();c.walk!.railings={...railing,gap:{position:0,width:2}};
    for(const radius of [7,10]){const w=updateCurvedWall(c,{radius}),runs=railingRuns(w),run=runs[0],r=radius-wallWalkProfile(w).inner+.02;expect(runs).toHaveLength(1);expect(run.closed).toBe(false);expect(run.top[0]).not.toEqual(run.top.at(-1));expect(run.posts.length).toBeGreaterThan(10);expect(w.walk!.railings!.gap).toEqual({position:0,width:2});
      const a=run.top[0],b=run.top.at(-1)!,chord=distance(a,b);expect(chord).toBeCloseTo(2*r*Math.sin(1.02/r));}
    const straight=wall();straight.walk!.railings={...railing,gap:{position:.25,width:2}};expect(railingRuns(straight)).toHaveLength(2);expect(railingRuns(straight)[0].top.at(-1)![0]).toBeCloseTo(1.98);expect(railingRuns(straight)[1].top[0][0]).toBeCloseTo(4.02);
  });
  it('validates edits atomically and preserves disabling, lock, preview, undo and redo behavior',()=>{
    const w=wall(),editor=new Editor(scene(w,flight())),before=editor.getSnapshot().project;
    for(const settings of [{height:NaN,spacing:1},{height:.1,spacing:1},{height:1,spacing:.1},{height:1,spacing:6},{...railing,gap:{position:0,width:2}}])expect(()=>editor.execute({type:'replace',entity:{...w,walk:{...w.walk!,railings:settings}}},'Invalid')).toThrow();
    expect(editor.getSnapshot().project).toBe(before);
    const noRail={...w,walk:{...w.walk!,railings:undefined}};editor.begin('Rail preview');editor.preview({type:'replace',entity:noRail});expect(railingRuns(editor.getSnapshot().preview!.entities[1] as Wall)).toEqual([]);editor.cancel();
    editor.execute({type:'replace',entity:noRail},'Remove railing');expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(railingRuns(editor.getSnapshot().project.entities[1] as Wall)).toEqual([]);
    const p=scene(w);p.layers[0].locked=true;expect(()=>applyCommand(p,{type:'replace',entity:noRail})).toThrow('Unlock');
    const huge=updateCurvedWall(circle(),{radius:90});huge.walk!.railings!.spacing=.2;expect(()=>scene(huge)).toThrow('512');
  });
  it('copies railing settings with their host and accounts for tall rails when framing and stacking',()=>{
    const s=flight(),p=scene(s),copied=applyCommand(p,pasteSelection(p,copySelection(p,s.id),'level','copy').command);expect((copied.entities.find(e=>e.kind==='slab'&&e.id!==s.id) as Slab).stairs!.railings).toEqual(s.stairs!.railings);
    const above=duplicateAbove(p,'level',4,'up');expect((above.project.entities.find(e=>e.id==='up-part-0') as Slab).stairs!.railings).toEqual(s.stairs!.railings);
    const w=wall();w.walk!.railings!.height=2.5;expect(partBounds(w,level).max[1]).toBeCloseTo(11.4);
    const short=updateStairs(s,{rise:.5,run:2,steps:4});expect(()=>duplicateAbove(scene(short),'level',.5,'low')).toThrow('overlap');
  });
  it('migrates format 25 without adding railings and round trips all settings through local and portable storage',async()=>{
    const oldWall=wall(),oldStair=flight();delete oldWall.walk!.railings;delete oldStair.stairs!.railings;
    const p=scene(oldWall,oldStair),old={...p,version:25},snapshot=structuredClone(old);expect(parseProject(old)).toEqual(p);expect(old).toEqual(snapshot);expect(()=>parseProject({...old,entities:[level,wall(),flight()]})).toThrow();
    const withRailings=scene(circle(),flight());expect(deserializeProject(serializeProject(withRailings))).toEqual(withRailings);await saveLocal(withRailings);expect(await loadLocal()).toEqual(withRailings);
  });
});
