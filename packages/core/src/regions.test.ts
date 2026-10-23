import { defaultLayers } from './layers';
import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import legacy from '../../../examples/water-system.olc.json';
import {createSite,createRegion,createBuilding,createLake,createOcean,createPath,createRiver,Editor,evaluateProject,generatePlanting,parseProject,plantingObstacle,type PlantingRegion,type Instance,type MaterialRegion} from './index';
import {regionIssue,lakeDistance,type PathPoint} from '@openlandcraft/landscape';
import {serializeProject,deserializeProject,saveLocal,loadLocal} from '@openlandcraft/project';

const points:PathPoint[]=[[-25,-25],[25,-25],[25,25],[-25,25]];
const scene=()=>({...createSite({name:'Regions',width:80,depth:80,resolution:129,preset:'flat'}),assets:parseProject(legacy).assets});
const planting=()=>createRegion(scene(),'planting',points) as PlantingRegion;
describe('M6c landscape regions',()=>{
  it('migrates v10 with exact terrain, water and source bytes; old versions reject new entities',()=>{
    const before=structuredClone(legacy);expect(parseProject(legacy)).toEqual({...legacy,version:31,layers:defaultLayers(),objectLayers:{},activeLayerId:"default"});expect(legacy).toEqual(before);
    expect(()=>parseProject({...legacy,entities:[...legacy.entities,createRegion(parseProject(legacy),'material')]})).toThrow();
    expect(()=>parseProject({...legacy,version:15})).toThrow();
  });
  it('accepts concave boundaries and either winding; rejects contact, crossings and out-of-site areas',()=>{
    const site=scene().site,concave:PathPoint[]=[[-10,-10],[10,-10],[10,0],[0,0],[0,10],[-10,10]];
    expect(regionIssue(concave,site)).toBeNull();expect(regionIssue([...concave].reverse(),site)).toBeNull();
    for(const p of [[[0,0],[10,10],[0,10],[10,0]],[[0,0],[10,0],[0,0],[0,10]],[[-41,0],[0,0],[0,10]]] as PathPoint[][])expect(regionIssue(p,site)).toBeTruthy();
  });
  it('rejects invalid settings, missing models and region budgets atomically',()=>{
    const project=scene(),region=planting(),editor=new Editor(project),before=editor.getSnapshot();
    for(const patch of [{seed:1.5},{density:NaN},{scaleMin:3,scaleMax:1},{assetId:'missing'},{points:Array.from({length:17},()=>[0,0])},{extra:1}]){
      expect(()=>editor.execute({type:'planting',region:{...region,...patch} as PlantingRegion},'Bad')).toThrow();expect(editor.getSnapshot()).toBe(before);
    }
    const material=createRegion(project,'material');expect(()=>parseProject({...project,entities:Array.from({length:9},(_,i)=>({...material,id:`r${i}`}))})).toThrow('eight');
  });
  it('is deterministic and respects area, center spacing, scale range, count cap and source bytes',()=>{
    const project=scene(),region={...planting(),density:100,spacing:0.5},a=generatePlanting(project,region),b=generatePlanting(project,region);
    expect(a).toEqual(b);expect(a.requested).toBe(2500);expect(a.instances).toHaveLength(200);expect(project.assets).toEqual(parseProject(legacy).assets);
    a.instances.forEach((p,i)=>{expect(lakeDistance(region.points,p.position[0],p.position[2])).toBeGreaterThanOrEqual(region.spacing/2);expect(p.scale[0]).toBeGreaterThanOrEqual(region.scaleMin);expect(p.scale[0]).toBeLessThanOrEqual(region.scaleMax);a.instances.slice(i+1).forEach(q=>expect(Math.hypot(q.position[0]-p.position[0],q.position[2]-p.position[2])).toBeGreaterThanOrEqual(region.spacing));});
    expect(generatePlanting(project,{...region,seed:region.seed+1}).instances).not.toEqual(a.instances);
  });
  it('excludes lake/river banks, ocean low ground, paths and rotated buildings including hidden objects',()=>{
    const project=scene(),region=planting(),lake=createLake(project,[[-10,-10],[10,-10],[10,10],[-10,10]]),river={...createRiver(project),points:[[-25,1,-20],[25,1,-20]] as [number,number,number][]};
    const path={...createPath(project),points:[[-25,20],[25,20]] as PathPoint[]};
    const building=createBuilding(project,20,0,8,10);if(building[0].kind==='level')building[0].rotation=45;
    const full=parseProject({...project,entities:[{...lake,visible:false},river,path,...building]}),blocked=plantingObstacle(evaluateProject(full),region),result=generatePlanting(full,region);
    expect(blocked(0,0)).toBe(true);expect(blocked(0,-20)).toBe(true);expect(blocked(0,20)).toBe(true);expect(blocked(20,0)).toBe(true);
    expect(result.instances.length).toBeGreaterThan(0);result.instances.forEach(p=>expect(blocked(p.position[0],p.position[2])).toBe(false));
    const sea={...project,entities:[{...createOcean(),level:3}]};expect(generatePlanting(sea,region).instances).toHaveLength(0);
    expect(generatePlanting(sea,{...region,exclusions:{...region.exclusions,water:false}}).instances.length).toBeGreaterThan(0);
  });
  it('previews regeneration as one history step and round trips exact results and source data',async()=>{
    const editor=new Editor(scene()),region={...planting(),density:2},before=editor.getSnapshot().project;
    editor.begin('Plant');editor.preview({type:'planting',region});expect(editor.getSnapshot().project).toBe(before);expect(editor.getSnapshot().preview!.entities.length).toBeGreaterThan(1);editor.cancel();expect(editor.getSnapshot().project).toBe(before);
    editor.begin('Plant');editor.preview({type:'planting',region});editor.commit();const after=editor.getSnapshot().project;
    expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toBe(before);editor.redo();expect(editor.getSnapshot().project).toBe(after);
    expect(deserializeProject(serializeProject(after))).toEqual(after);await saveLocal(after);expect(await loadLocal()).toEqual(after);
  });
  it('detaches manually moved plants, preserving IDs and transforms through regeneration and region deletion',()=>{
    const editor=new Editor(scene()),region={...planting(),density:2};editor.execute({type:'planting',region},'Plant');
    const plant=editor.getSnapshot().project.entities.find(e=>e.kind==='instance') as Instance,moved={...plant,position:[-30,0,-30] as Instance['position']};
    editor.execute({type:'replace',entity:moved},'Move plant');let manual=editor.getSnapshot().project.entities.find(e=>e.id===plant.id) as Instance;expect(manual.regionId).toBeUndefined();
    editor.execute({type:'planting',region},'Regenerate');expect(editor.getSnapshot().project.entities.find(e=>e.id===plant.id)).toEqual(manual);
    editor.execute({type:'remove',id:region.id},'Delete region');expect(editor.getSnapshot().project.entities).toEqual([manual]);editor.undo();expect(editor.getSnapshot().project.entities.some(e=>e.kind==='instance'&&e.regionId===region.id)).toBe(true);
    editor.undo();editor.undo();expect((editor.getSnapshot().project.entities.find(e=>e.id===plant.id) as Instance).regionId).toBe(region.id);
  });
  it('hides owned plants with their region and protects the model source even for empty planting',()=>{
    const editor=new Editor(scene()),region={...planting(),density:1};editor.execute({type:'planting',region},'Plant');editor.execute({type:'replace',entity:{...region,visible:false}},'Hide');
    const project=editor.getSnapshot().project;expect(project.entities.filter(e=>e.kind==='instance').every(e=>e.visible)).toBe(true);expect(evaluateProject(project).entities.filter(e=>e.kind==='instance').every(e=>!e.visible)).toBe(true);
    expect(()=>editor.execute({type:'removeAsset',id:region.assetId},'Remove')).toThrow();expect(()=>editor.execute({type:'replace',entity:{...region,seed:5}},'Unsafe replace')).toThrow('regeneration');
  });
  it('keeps surface editing independent of terrain and preserves explicit overlap order',()=>{
    const editor=new Editor(scene()),a=createRegion(scene(),'material') as MaterialRegion,b={...a,id:'later',color:'#112233'},terrain=editor.getSnapshot().project.site.terrain;
    editor.execute({type:'insert',entities:[a,b]},'Regions');editor.begin('Surface');editor.preview({type:'replace',entity:{...a,color:'#445566'}});expect(editor.getSnapshot().preview!.entities.map(e=>e.id)).toEqual([a.id,b.id]);editor.commit();expect(evaluateProject(editor.getSnapshot().project).site.terrain).toBe(terrain);editor.execute({type:'remove',id:a.id},'Remove');expect(editor.getSnapshot().project.site.terrain).toBe(terrain);
  });
  it('rejects regeneration over the shared generated-plant budget without changing the document',()=>{
    const project=scene(),template=planting(),owners=Array.from({length:3},(_,i)=>({...template,id:`owner-${i}`}));
    const instances=Array.from({length:499},(_,i):Instance=>({id:`existing-${i}`,kind:'instance',parentId:'site',name:'Plant',visible:true,assetId:template.assetId,regionId:owners[Math.floor(i/200)].id,position:[-35,0,-35],rotation:0,scale:[1,1,1],anchor:'terrain'}));
    const editor=new Editor({...project,entities:[...owners,...instances]}),before=editor.getSnapshot();
    expect(()=>editor.execute({type:'planting',region:{...template,id:'fourth',density:1}},'Over budget')).toThrow('500 generated');expect(editor.getSnapshot()).toBe(before);
  });
});
