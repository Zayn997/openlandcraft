import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {applyCommand,createBuilding,createSite,createStairs,DEFAULT_STAIRS,DEFAULT_TOWER,Editor,newTower,parseProject,type Slab,type Level,type Wall,type Roof} from '@openlandcraft/core';
import {TowerSelection} from './TowerTools';
import {CircularFloorEditor} from './CircularFloorEditor';
import {WorkspaceSidebar} from './WorkspaceSidebar';
import {WallEditor} from './WallEditor';
import {OutlineEditor} from './OutlineEditor';
import {OpeningEditor} from './OpeningEditor';

vi.mock('@openlandcraft/core',async importOriginal=>{
 const core=await importOriginal<typeof import('@openlandcraft/core')>();
 return {...core,applyCommand:vi.fn(core.applyCommand)};
});
const noop=()=>{};
function fixture(){
 let project=createSite({name:'Selection',width:80,depth:80,resolution:129,preset:'flat'});
 project=applyCommand(project,{type:'towerType',definition:{...DEFAULT_TOWER,id:'spire-type',name:'Spire',top:'roof'}});
 const {tower,level}=newTower('spire-type',[0,2,0],'spire');
 project=applyCommand(project,{type:'tower',tower,level:{...level,name:'Hill tower'}});
 const editor=new Editor(project);
 vi.mocked(applyCommand).mockClear();
 return editor;
}

describe('selection renders only committed properties',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('exposes floor, roof and stair fields in the shared wrapper without an edit-mode prerequisite',()=>{
  const site=createSite({name:'Properties',width:80,depth:80,resolution:129,preset:'flat'});
  const entities=createBuilding(site,0,0,12,8,'floor'),level=entities.find((e):e is Level=>e.kind==='level')!;
  const straight=new Editor(parseProject({...site,entities})),tower=fixture();
  const stairs=createStairs(level.id,[0,0],[6,0],DEFAULT_STAIRS);
  const cases=[...entities.filter((e):e is Slab|Roof=>e.kind==='slab'||e.kind==='roof').map(part=>({part,editor:straight})),{part:stairs,editor:straight},...tower.getSnapshot().project.entities.filter((e):e is Slab|Roof=>e.kind==='slab'||e.kind==='roof').map(part=>({part,editor:tower}))];
  vi.mocked(applyCommand).mockClear();
  for(const {part,editor} of cases)for(const editing of [false,true]){
   const before=editor.getSnapshot();
   const markup=renderToStaticMarkup(<OutlineEditor part={part} editor={editor} editing={editing} onEdit={noop} handle={{mode:'vertex',index:0}} onHandle={noop} snapping={true} onSnapping={noop} onFrame={noop} onFinish={noop} onSelect={noop} status="" onStatus={noop}/>);
   expect(markup).toContain('properties-panel');
   expect(markup).toContain('type="number"');
   expect(markup).toContain('type="submit"');
   expect(markup).not.toContain('SELECTED ELEMENT');
   expect(editor.getSnapshot()).toBe(before);
  }
  expect(applyCommand).not.toHaveBeenCalled();
 });
 it('shows door and window fields on selection without starting a transaction',()=>{
  const editor=fixture(),wall=editor.getSnapshot().project.entities.find((e):e is Wall=>e.kind==='wall')!;
  for(const kind of ['door','window'] as const){
   const opening={id:kind,kind,offset:1,width:1,height:2,sill:0};
   const markup=renderToStaticMarkup(<OpeningEditor wall={{...wall,openings:[opening]}} opening={opening} editor={editor} levels={[]} onLevel={noop} onSelect={noop} snapping={true} onSnapping={noop} onFinish={noop} onFrame={noop} onStatus={noop} status="" editing={false}/>);
   expect(markup).toContain('aria-label="Opening width"');
   expect(markup).toMatch(/disabled=""[^>]*>Apply opening changes/);
   expect(markup).toContain('properties-panel');
  }
  expect(applyCommand).not.toHaveBeenCalled();
  expect(editor.getSnapshot().gestureLabel).toBeNull();
 });
 it('offers the same editable wall fields on selection and shape editing without validating unchanged scenes',()=>{
  const site=createSite({name:'Wall properties',width:80,depth:80,resolution:129,preset:'flat'});
  const straight=new Editor(parseProject({...site,entities:createBuilding(site,0,0,12,8,'floor')}));
  const curved=fixture();
  for(const editor of [straight,curved]){
   const snapshot=editor.getSnapshot(),wall=snapshot.project.entities.find((e):e is Wall=>e.kind==='wall')!;
   vi.mocked(applyCommand).mockClear();
   for(const editing of [false,true]){
    const markup=renderToStaticMarkup(<WallEditor wall={wall} editing={editing} editor={editor} snapping={true} onSnapping={noop} onFrame={noop} onEdit={noop} onFinish={noop} onSelect={noop} status="Drag the wall body or its handles." onStatus={noop}/>);
    expect(markup).toContain('aria-label="Wall height"');
    expect(markup).toContain('aria-label="Base elevation"');
    expect(markup).toContain('aria-label="Wall name"');
    expect(markup).toMatch(/disabled=""[^>]*>Apply changes/);
    expect(markup).not.toContain('SELECTED ELEMENT');
    expect(markup).not.toContain('Double-click');
   }
   expect(applyCommand).not.toHaveBeenCalled();
   expect(editor.getSnapshot()).toBe(snapshot);
  }
 });
 it('shows a tower and any of its components without regenerating or validating the scene',()=>{
  const editor=fixture(),snapshot=editor.getSnapshot();
  for(const id of ['spire-level','spire-wall','spire-roof','spire-floor0']){
   const markup=renderToStaticMarkup(<TowerSelection editor={editor} id={id} onSelect={noop} onError={noop}/>);
   expect(markup).toContain('Hill tower');
   expect(markup).toMatch(/disabled=""[^>]*>Apply tower dimensions/);
  }
  expect(applyCommand).not.toHaveBeenCalled();
  expect(editor.getSnapshot()).toBe(snapshot);
 });
 it('reads circular floors, including opening the unchanged editor, without running a scene edit',()=>{
  const editor=fixture(),project=editor.getSnapshot().project;
  const part=project.entities.find(e=>e.id==='spire-floor0') as Slab;
  const level=project.entities.find(e=>e.id==='spire-level') as Level;
  for(const editing of [false,true]){
   const markup=renderToStaticMarkup(<CircularFloorEditor part={part} level={level} editing={editing} editor={editor} handle={{mode:'vertex',index:0}} onHandle={noop} snapping={false} onSnapping={noop} onFrame={noop} onFinish={noop} onSelect={noop} status="" onStatus={noop}/>);
   expect(markup).toContain('aria-label="Floor radius"');
   expect(markup).toMatch(/disabled=""[^>]*>Apply floor dimensions/);
  }
  expect(applyCommand).not.toHaveBeenCalled();
 });
 it('ignores ordinary objects without starting a tower edit',()=>{
  const editor=fixture();
  expect(renderToStaticMarkup(<TowerSelection editor={editor} id="terrain" onSelect={noop} onError={noop}/>)).toBe('');
  expect(applyCommand).not.toHaveBeenCalled();
 });
 it('keeps inactive sidebar tabs out of the urgent render',()=>{
  vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='olc-sidebar-tab'?'objects':null});
  const layers=vi.fn(()=> <div>Layer tree</div>),objects=vi.fn(()=> <div>Scene tree</div>),assets=vi.fn(()=> <div>Asset library</div>);
  renderToStaticMarkup(<WorkspaceSidebar mobileActive={false} layers={<LayerProbe/>} objects={<ObjectProbe/>} assets={<AssetProbe/>} actions={null}/>);
  function LayerProbe(){return layers();}function ObjectProbe(){return objects();}function AssetProbe(){return assets();}
  expect(layers).not.toHaveBeenCalled();
  expect(objects).toHaveBeenCalledOnce();
  expect(assets).not.toHaveBeenCalled();
 });
 it('defers all sidebar contents when the sidebar is collapsed',()=>{
  vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='olc-sidebar-collapsed'?'true':null});
  const panel=vi.fn(()=> <div>Sidebar contents</div>);
  function Probe(){return panel();}
  renderToStaticMarkup(<WorkspaceSidebar mobileActive={false} layers={<Probe/>} objects={<Probe/>} assets={<Probe/>} actions={null}/>);
  expect(panel).not.toHaveBeenCalled();
 });
});
