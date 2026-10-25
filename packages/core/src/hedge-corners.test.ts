import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {createSite,createHedge,applyCommand,Editor,parseProject,mirrorMemberId,ROUND_HEDGE_GESTURE,type Hedge,type MirrorRule} from './index';
import {hedgeCornerAmounts,hedgeRoute,hedgeStrips,routeCorner,lakeDistance,type PathPoint} from '@openlandcraft/landscape';
import {serializeProject,deserializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
const base=()=>createSite({name:'Hedge corners',width:60,depth:60,resolution:129,preset:'flat'});
const seed=base(),points:PathPoint[]=[[-15,-8],[-4,-8],[-4,6],[10,6]];
const run=(patch:Partial<Hedge>={}):Hedge=>({...createHedge(seed,points),id:'hedge-corners',...patch});
const scene=(h=run())=>applyCommand(base(),{type:'add',entity:h});
describe('individual hedge corner fillets',()=>{
 it('preserves old uniform rounding and changes only the chosen anchor',()=>{
  const old=run({rounding:.5}),amounts=hedgeCornerAmounts(old);expect(amounts).toEqual([0,.5,.5,0]);expect(hedgeRoute(old)).toEqual(hedgeRoute({...old,cornerRounding:amounts}));
  const h={...old,cornerRounding:[0,.8,.5,0]},a=routeCorner(h,1)!,b=routeCorner(h,2)!;expect(a.radius).toBeGreaterThan(routeCorner({...old,cornerRounding:amounts},1)!.radius);expect(b.radius).toBe(routeCorner({...old,cornerRounding:amounts},2)!.radius);expect(old.cornerRounding).toBeUndefined();
 });
 it('rounds the first/last anchors of closed loops without opening the seam or filling the center',()=>{
  const h=run({closed:true,points:[[-8,-8],[8,-8],[8,8],[-8,8]],cornerRounding:[.5,0,.75,.25]});expect(()=>scene(h)).not.toThrow();
  const route=hedgeRoute(h);expect(route[0]).toEqual(route.at(-1));expect(routeCorner(h,0)!.radius).toBeGreaterThan(0);expect(routeCorner(h,1)!.radius).toBe(0);expect(routeCorner(h,3)!.radius).toBeGreaterThan(0);expect(route).not.toContainEqual(h.points[0]);expect(hedgeStrips(h).some(s=>lakeDistance(s,0,0)>0)).toBe(false);
  const reverse={...h,points:[...h.points].reverse(),cornerRounding:[...h.cornerRounding!].reverse()};expect(()=>scene(reverse)).not.toThrow();
 });
 it('retains one undo step per slider gesture and restores previews on cancel',()=>{
  const p=scene(),editor=new Editor(p);editor.begin(ROUND_HEDGE_GESTURE);for(const amount of [.1,.3,.7])editor.preview({type:'replace',entity:run({cornerRounding:[0,amount,0,0]})});editor.commit();expect(editor.getSnapshot().past).toHaveLength(1);expect(editor.getSnapshot().project.entities[0]).toMatchObject({cornerRounding:[0,.7,0,0]});editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();
  const before=editor.getSnapshot().project;editor.begin(ROUND_HEDGE_GESTURE);editor.preview({type:'replace',entity:run({cornerRounding:[0,.2,0,0]})});editor.cancel();expect(editor.getSnapshot().project).toEqual(before);
 });
 it('rejects malformed arrays and open endpoint fillets atomically',()=>{
  const editor=new Editor(scene()),before=editor.getSnapshot();for(const cornerRounding of [[0,.5],[.2,.5,0,0],[0,.5,0,.2],[0,NaN,0,0],[0,1.1,0,0]]){expect(()=>editor.execute({type:'replace',entity:run({cornerRounding})},'Bad corner')).toThrow();expect(editor.getSnapshot()).toBe(before);}
 });
 it('follows source corner edits through mirroring and retains data in format 39',async()=>{
  const h=run({cornerRounding:[0,.2,.6,0]}),r:MirrorRule={id:'mirrored-hedge',name:'Mirror hedge',sourceIds:[h.id],start:[16,-20],end:[16,20]};
  // Use the site center for a bounded mirrored copy of a wholly left-hand run.
  h.points=h.points.map(([x,z])=>[x-12,z]);r.start=[0,-20];r.end=[0,20];
  let p=applyCommand(scene(h),{type:'mirror',rule:r});p=applyCommand(p,{type:'replace',entity:{...h,cornerRounding:[0,.8,.6,0]}});expect(p.entities.find(e=>e.id===mirrorMemberId(r,h.id))).toMatchObject({cornerRounding:[0,.8,.6,0]});expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);expect(()=>parseProject({...p,version:38})).toThrow('format 39');
  const old={...base(),version:38,entities:[run({rounding:.5})]},upgraded=parseProject(old);expect(upgraded.entities).toEqual(old.entities);expect(upgraded.version).toBe(39);expect(old.version).toBe(38);
 });
});
