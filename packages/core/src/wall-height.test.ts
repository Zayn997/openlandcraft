import { describe, expect, it } from 'vitest';
import { applyCommand, createBuilding, createCurvedWall, createSite, DEFAULT_TOWER, Editor, newTower, parseProject, resizeWallBase, resizeWallHeight, type Wall } from './index';
import { deserializeProject, serializeProject } from '@openlandcraft/project';

function fixture() {
  const site=createSite({name:'Wall height',width:80,depth:80,resolution:129,preset:'flat'});
  const project=parseProject({...site,entities:createBuilding(site,0,0,12,8,'floor')});
  const wall=project.entities.find((e):e is Wall=>e.kind==='wall')!;
  return {project,wall};
}
describe('Direct wall height resizing',()=>{
  it('moves the lower edge in either direction while keeping the top fixed',()=>{
    const {wall}=fixture(),top=wall.elevation+wall.height;
    for(const delta of [-1,.5]){
      const next=resizeWallBase(wall,delta,false);
      expect(next.elevation).toBeCloseTo(wall.elevation+delta);expect(next.height).toBeCloseTo(wall.height-delta);
      expect(next.elevation+next.height).toBeCloseTo(top);expect(next.start).toBe(wall.start);expect(next.end).toBe(wall.end);
    }
  });
  it('snaps the lower edge elevation and rejects crossing the top or exceeding bounds',()=>{
    const {wall}=fixture(),next=resizeWallBase(wall,.41,true);
    expect(next.elevation).toBe(.5);expect(next.height+next.elevation).toBeCloseTo(wall.height+wall.elevation);
    for(const delta of [NaN,Infinity,4,-31])expect(()=>resizeWallBase(wall,delta,false)).toThrow();
  });
  it('moves connected lower edges together, with unchanged top and undoable cancellation',()=>{
    const {project,wall}=fixture(),editor=new Editor(project),top=wall.height+wall.elevation;
    editor.begin('Resize wall height');editor.preview({type:'replace',entity:resizeWallBase(wall,-1,false)});
    const preview=editor.getSnapshot().preview!;
    for(const item of preview.entities.filter((e):e is Wall=>e.kind==='wall')){
      expect(item.elevation).toBeCloseTo(wall.elevation-1);expect(item.height+item.elevation).toBeCloseTo(top);
    }
    editor.cancel();expect(editor.getSnapshot().project).toEqual(project);
    editor.begin('Resize wall height');editor.preview({type:'replace',entity:resizeWallBase(wall,-1,false)});editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(project);
  });
  it('raises and lowers only height, retaining base, footprint, identity and hosted openings',()=>{
    const {wall}=fixture();wall.openings=[{id:'window',kind:'window',offset:2,width:1,height:1,sill:.5}];
    const raised=resizeWallHeight(wall,1.23,false),lowered=resizeWallHeight(wall,-.5,false);
    expect(raised).toEqual({...wall,height:4.43});expect(lowered).toEqual({...wall,height:2.7});
    expect(raised.openings).toBe(wall.openings);expect(raised.start).toBe(wall.start);expect(raised.end).toBe(wall.end);
  });
  it('snaps height to 0.25 m and allows precise unsnapped changes',()=>{
    const {wall}=fixture();expect(resizeWallHeight(wall,.41,true).height).toBe(3.5);
    expect(resizeWallHeight(wall,.41,false).height).toBe(3.61);
  });
  it('rejects nonfinite heights, limits and cuts through openings',()=>{
    const {wall}=fixture();
    for(const delta of [NaN,Infinity,-4,30])expect(()=>resizeWallHeight(wall,delta,false)).toThrow();
    wall.openings=[{id:'window',kind:'window',offset:2,width:1,height:1.2,sill:.9}];
    expect(()=>resizeWallHeight(wall,-1.1,false)).toThrow('opening');
  });
  it('keeps circular and arc footprints unchanged',()=>{
    for(const shape of ['arc','circle'] as const){
      const wall=createCurvedWall('floor',shape,shape==='arc'?[[0,0],[5,0],[0,5]]:[[0,0],[5,0]],.4,6,false,2,'curve');
      expect(resizeWallHeight(wall,2,false)).toEqual({...wall,height:8});
    }
  });
  it('previews connected heights without history, then commits one undo entry and reopens',()=>{
    const {project,wall}=fixture(),editor=new Editor(project);
    editor.begin('Resize wall height');
    for(const delta of [.5,1,2])editor.preview({type:'replace',entity:resizeWallHeight(wall,delta,true)});
    expect(editor.getSnapshot().project).toEqual(project);expect(editor.getSnapshot().past).toHaveLength(0);
    expect(editor.getSnapshot().preview!.entities.filter(e=>e.kind==='wall').every(e=>e.height===5.25)).toBe(true);
    editor.commit();const after=editor.getSnapshot().project;
    expect(editor.getSnapshot().past).toHaveLength(1);expect(deserializeProject(serializeProject(after))).toEqual(after);
    editor.undo();expect(editor.getSnapshot().project).toEqual(project);editor.redo();expect(editor.getSnapshot().project).toEqual(after);
  });
  it('cancels the entire gesture when a connected wall opening blocks the final height',()=>{
    const {project,wall}=fixture();const neighbor=project.entities.filter((e):e is Wall=>e.kind==='wall')[1];
    neighbor.openings=[{id:'tall-window',kind:'window',offset:2,width:1,height:2.5,sill:.4}];
    const before=parseProject(project),editor=new Editor(before);editor.begin('Resize wall height');
    editor.preview({type:'replace',entity:resizeWallHeight(wall,1,false)});
    expect(()=>editor.preview({type:'replace',entity:resizeWallHeight(wall,-.5,false)})).toThrow('opening');
    editor.cancel();expect(editor.getSnapshot().project).toEqual(before);expect(editor.getSnapshot().past).toHaveLength(0);
  });
  it('rejects edits that would modify a locked joined wall',()=>{
    const {project,wall}=fixture();const neighbor=project.entities.filter((e):e is Wall=>e.kind==='wall')[1];
    const locked=parseProject({...project,layers:[...project.layers,{id:'locked',name:'Locked',parentId:null,color:'#888888',visible:true,locked:true}],objectLayers:{...project.objectLayers,[neighbor.id]:'locked'}});
    const editor=new Editor(locked);editor.begin('Resize wall height');
    expect(()=>editor.preview({type:'replace',entity:resizeWallHeight(wall,1,false)})).toThrow(/Unlock/);
    editor.cancel();expect(editor.getSnapshot().project).toEqual(locked);
  });
  it('preserves tower ownership and lets the attached roof follow a native height edit',()=>{
    const site=createSite({name:'Tower height',width:80,depth:80,resolution:129,preset:'flat'});
    const project=applyCommand(site,{type:'batch',commands:[{type:'towerType',definition:{...DEFAULT_TOWER,id:'type',name:'Tower',top:'roof'}},{type:'tower',...newTower('type',[0,2,0],'tower')}]});
    const wall=project.entities.find(e=>e.id==='tower-wall') as Wall;
    const changed=applyCommand(project,{type:'replace',entity:resizeWallHeight(wall,2,false)});
    expect(changed.entities.find(e=>e.id==='tower-wall')).toMatchObject({height:14,elevation:wall.elevation,curve:wall.curve});
    expect(changed.entities.find(e=>e.id==='tower-roof')).toMatchObject({elevation:wall.elevation+14});
    expect(changed.towerAssemblies).toHaveLength(1);expect(changed.towerTypes).toEqual(project.towerTypes);
  });
});
