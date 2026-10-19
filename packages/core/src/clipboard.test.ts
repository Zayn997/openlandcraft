import { describe, expect, it } from 'vitest';
import { applyCommand, copySelection, createBuilding, createProject, createUnit, Editor, pasteSelection, type Wall } from './index';
import tree from '../../../examples/demo-tree.asset.json';

function scene() {
  const project = createProject(), parts = createBuilding(project,-24,4,12,8,'floor');
  const wall = parts.find((e): e is Wall => e.kind === 'wall')!;
  wall.openings = [{ id:'door',kind:'door',offset:1,width:1,height:2.1,sill:0 },{ id:'window',kind:'window',offset:4,width:1.2,height:1.1,sill:1 }];
  return { project:applyCommand(project,{type:'insert',entities:parts}), wall };
}
describe('Editor clipboard', () => {
  it('keeps a copy-time snapshot and pastes independent IDs at successive offsets', () => {
    const {project,wall}=scene(), clip=copySelection(project,wall.id), editor=new Editor(project);
    editor.execute({type:'remove',id:wall.id},'Remove source');
    const first=pasteSelection(editor.getSnapshot().project,clip,'floor','first'); editor.execute(first.command,'Paste');
    const copy=editor.getSnapshot().project.entities.find(e=>e.id===first.selectedIds[0]) as Wall;
    expect(copy.start).toEqual([wall.start[0]+2,wall.start[1]+2]);expect(copy.openings).toHaveLength(2);expect(copy.openings![0].id).not.toBe('door');
    const second=pasteSelection(editor.getSnapshot().project,clip,copy.id,'second',2);editor.execute(second.command,'Paste');
    expect((editor.getSnapshot().project.entities.find(e=>e.id===second.selectedIds[0]) as Wall).start).toEqual([wall.start[0]+4,wall.start[1]+4]);
    editor.undo();expect(editor.getSnapshot().project.entities.some(e=>e.id===second.selectedIds[0])).toBe(false);
    editor.redo();expect(editor.getSnapshot().project.entities.some(e=>e.id===second.selectedIds[0])).toBe(true);
  });
  it('copies multiple parts in one atomic paste without changing the source', () => {
    const {project,wall}=scene(), slab=project.entities.find(e=>e.kind==='slab')!;
    const clip=copySelection(project,wall.id,[wall.id,slab.id]), editor=new Editor(project);
    const result=pasteSelection(project,clip,'floor','multiple');editor.execute(result.command,'Paste');
    expect(result.selectedIds).toHaveLength(2);expect(editor.getSnapshot().past).toHaveLength(1);
    expect(editor.getSnapshot().project.entities.filter(e=>!result.selectedIds.includes(e.id))).toEqual(project.entities);
    editor.undo();expect(editor.getSnapshot().project).toEqual(project);
  });
  it('retains floor ownership and units while moving a copied floor only once', () => {
    const {project}=scene(), memberIds=project.entities.filter(e=>e.parentId==='floor').map(e=>e.id);
    const unit=createUnit(project,memberIds,'Suite','unit');
    const grouped=applyCommand(project,{type:'add',entity:unit}), clip=copySelection(grouped,'floor');
    const result=pasteSelection(grouped,clip,null,'floor-copy'), after=applyCommand(grouped,result.command);
    const level=after.entities.find(e=>e.id===result.selectedIds[0]);expect(level?.kind).toBe('level');
    const copiedUnit=after.entities.find(e=>e.kind==='unit'&&e.parentId===level?.id);
    expect(copiedUnit?.kind==='unit'&&copiedUnit.memberIds.every(id=>after.entities.some(e=>e.id===id&&e.parentId===level?.id))).toBe(true);
    const original=project.entities.find(e=>e.kind==='slab')!, copied=after.entities.find(e=>e.kind==='slab'&&e.parentId===level?.id)!;
    expect(copied.kind==='slab'&&original.kind==='slab'&&copied.center).toEqual(original.kind==='slab'&&original.center);
  });
  it('pastes apertures into free gaps, preserving the host and siblings', () => {
    const {project,wall}=scene(), clip=copySelection(project,wall.id,[],{wallId:wall.id,openingId:'window'});
    const result=pasteSelection(project,clip,wall.id,'aperture'), after=applyCommand(project,result.command);
    const updated=after.entities.find(e=>e.id===wall.id) as Wall;
    expect(updated.openings).toHaveLength(3);expect(updated.openings!.slice(0,2)).toEqual(wall.openings);
    expect(result.focus?.openingId).toBe(updated.openings![2].id);
    expect(updated.openings![2].offset).toBeCloseTo(5.4);
    expect(()=>pasteSelection(project,clip,'floor','wrong-host')).toThrow('Select a wall');
    const huge={...clip,opening:{...clip.kind==='opening'?clip.opening:wall.openings![0],width:20}} as typeof clip;
    expect(()=>pasteSelection(project,huge,wall.id,'too-large')).toThrow('No valid gap');
  });
  it('rejects missing targets without changing the project', () => {
    const {project,wall}=scene();expect(()=>copySelection(project,'terrain')).toThrow('Terrain');
    const clip=copySelection(project,wall.id), empty=createProject();
    expect(()=>pasteSelection(empty,clip,null,'orphan')).toThrow('destination floor');
    expect(()=>copySelection(project,wall.id,[],{wallId:wall.id,openingId:'stale'})).toThrow('existing');
  });
  it('reuses embedded assets in the same scene and restores them in another project', () => {
    const project=applyCommand(createProject(),{type:'insert',assets:[tree],entities:[{id:'tree',kind:'instance',parentId:'site',name:'Tree',visible:true,assetId:tree.id,position:[-20,0,12],rotation:0,scale:[1,1,1],anchor:'terrain'}]});
    const clip=copySelection(project,'tree'), same=pasteSelection(project,clip,null,'same'), after=applyCommand(project,same.command);
    expect(after.assets).toHaveLength(1);
    const fresh=createProject(), other=pasteSelection(fresh,clip,null,'other'), restored=applyCommand(fresh,other.command);
    expect(restored.assets).toHaveLength(1);expect(restored.assets[0].data).toBe(tree.data);
    const instance=restored.entities.find(e=>e.id===other.selectedIds[0]);
    expect(instance?.kind==='instance'&&instance.assetId).toBe(restored.assets[0].id);
  });
});
