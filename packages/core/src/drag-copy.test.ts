import { describe, expect, it } from 'vitest';
import { applyCommand, copySelection, createBuilding, createProject, Editor, parseProject, pasteSelection, type Level, type Wall } from './index';
import originalStudy from '../../../examples/coastal-study.olc.json';
import oldArchitecture from '../../../examples/coastal-architecture.olc.json';

function scene(rotation=0) {
  const site=createProject(), entities=createBuilding(site,-24,4,12,8,'floor');
  (entities.find(e=>e.kind==='level') as Level).rotation=rotation;
  const wall=entities.find((e):e is Wall=>e.kind==='wall')!;
  wall.openings=[{id:'window',kind:'window',offset:1,width:1.2,height:1.1,sill:1}];
  return {project:applyCommand(site,{type:'insert',entities}),wall};
}
describe('Alt-drag copy placement',()=>{
  it('copies the reported saved Massing 04 after save/load without changing its source',()=>{
    const block={id:'04fe0d1e-918d-4341-8973-e3f7459f2113',parentId:'site' as const,name:'Massing 04',visible:true,kind:'block' as const,position:[-18,5.711936120329576,17] as [number,number,number],size:[6,4,5] as [number,number,number],rotation:0,color:'#ded8ca'};
    const project=parseProject(JSON.parse(JSON.stringify(applyCommand(createProject(),{type:'add',entity:block}))));
    const result=pasteSelection(project,copySelection(project,block.id),block.id,'saved-massing',0,{worldDelta:[5,2],snapping:true});
    const next=applyCommand(project,result.command),copy=next.entities.find(e=>e.id===result.selectedIds[0]);
    expect(copy).toEqual({...block,id:result.selectedIds[0],name:'Massing 04 copy',position:[-13,block.position[1],19]});
    expect(next.entities.find(e=>e.id===block.id)).toEqual(block);
  });
  it.each([originalStudy,oldArchitecture])('copies massing blocks from a version $version saved project without recreating them',saved=>{
    const project=parseProject(saved);
    for(const block of project.entities.filter(e=>e.kind==='block')){
      const result=pasteSelection(project,copySelection(project,block.id),block.id,'legacy-'+block.id,0,{worldDelta:[4,2],snapping:true});
      const next=applyCommand(project,result.command),copy=next.entities.find(e=>e.id===result.selectedIds[0]);
      if(copy?.kind!=='block')throw new Error('Expected a copied massing block');
      expect(copy.position).toEqual([block.position[0]+4,block.position[1],block.position[2]+2]);
      expect(copy.size).toEqual(block.size);expect(copy.rotation).toBe(block.rotation);expect(copy.color).toBe(block.color);
      expect(next.entities.find(e=>e.id===block.id)).toEqual(block);
    }
  });
  it('moves the copy by the drag delta, with snapping and an unchanged source',()=>{
    const {project,wall}=scene(),clip=copySelection(project,wall.id);
    const result=pasteSelection(project,clip,wall.id,'drag',0,{worldDelta:[3.13,-1.12],snapping:true});
    const next=applyCommand(project,result.command), copy=next.entities.find(e=>e.id===result.selectedIds[0]) as Wall;
    expect(copy.start).toEqual([wall.start[0]+3.25,wall.start[1]-1]);
    expect(next.entities.find(e=>e.id===wall.id)).toEqual(wall);
    expect(copy.openings![0].id).not.toBe(wall.openings![0].id);
  });
  it('converts world drag into rotated floor coordinates without changing elevation',()=>{
    const {project,wall}=scene(90), result=pasteSelection(project,copySelection(project,wall.id),wall.id,'rotate',0,{worldDelta:[2,3],snapping:false});
    const next=applyCommand(project,result.command), copy=next.entities.find(e=>e.id===result.selectedIds[0]) as Wall;
    expect(copy.start[0]).toBeCloseTo(wall.start[0]-3);expect(copy.start[1]).toBeCloseTo(wall.start[1]+2);expect(copy.elevation).toBe(wall.elevation);
  });
  it('moves a complete floor in world space while retaining its local footprint',()=>{
    const {project,wall}=scene(90), result=pasteSelection(project,copySelection(project,'floor'),'floor','floor-drag',0,{worldDelta:[8,-4],snapping:false});
    const next=applyCommand(project,result.command), original=project.entities.find(e=>e.id==='floor') as Level, floor=next.entities.find(e=>e.id===result.selectedIds[0]) as Level;
    expect(floor.position).toEqual([original.position[0]+8,original.position[1],original.position[2]-4]);
    expect((next.entities.find(e=>e.kind==='wall'&&e.parentId===floor.id) as Wall).start).toEqual(wall.start);
  });
  it('detects actual displacement on a rotated local snap grid',()=>{
    const {project}=scene(45),slab=project.entities.find(e=>e.kind==='slab')!,clip=copySelection(project,slab.id);
    const moved=pasteSelection(project,clip,slab.id,'small-drag',0,{worldDelta:[0.1,0.1],snapping:true});
    expect(moved.displaced).toBe(true);
    const still=pasteSelection(project,clip,slab.id,'tiny-drag',0,{worldDelta:[0.01,0.01],snapping:true});
    expect(still.displaced).toBe(false);
  });
  it('places an opening at the dragged host offset and rejects overlap instead of finding another gap',()=>{
    const {project,wall}=scene(),clip=copySelection(project,wall.id,[],{wallId:wall.id,openingId:'window'});
    const dx=wall.end[0]-wall.start[0],dz=wall.end[1]-wall.start[1],length=Math.hypot(dx,dz);
    const result=pasteSelection(project,clip,wall.id,'opening-drag',0,{worldDelta:[dx/length*3.27,dz/length*3.27],snapping:true});
    const next=applyCommand(project,result.command),copy=(next.entities.find(e=>e.id===wall.id) as Wall).openings![1];
    expect(copy.offset).toBeCloseTo(4.3);expect(copy.sill).toBe(1);
    expect(()=>pasteSelection(project,clip,wall.id,'invalid',0,{worldDelta:[0,0],snapping:false})).toThrow();
  });
  it('previews stable IDs from the baseline and commits once, or cancels completely',()=>{
    const {project,wall}=scene(),clip=copySelection(project,wall.id),editor=new Editor(project);
    editor.begin('Alt-drag copy');
    for(const x of [1,2,3])editor.preview(pasteSelection(project,clip,wall.id,'stable',0,{worldDelta:[x,2],snapping:false}).command);
    expect(editor.getSnapshot().project).toEqual(project);expect(editor.getSnapshot().preview!.entities).toHaveLength(project.entities.length+1);
    editor.cancel();expect(editor.getSnapshot().past).toHaveLength(0);
    editor.begin('Alt-drag copy');editor.preview(pasteSelection(project,clip,wall.id,'stable',0,{worldDelta:[3,2],snapping:false}).command);editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(project);editor.redo();expect(editor.getSnapshot().project.entities).toHaveLength(project.entities.length+1);
  });
});

