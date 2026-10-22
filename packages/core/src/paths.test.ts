import { defaultLayers } from './layers';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import legacy from '../../../examples/river-water-study.olc.json';
import { createBuilding, createPath, createDrawnPath, createSite, Editor, evaluateProject, parseProject, snapPathPoint, plantingObstacle, type Path } from './index';
import { pathIssue, pathLength, roundedRoutePoints, TerrainStroke, DEFAULT_BRUSH } from '@openlandcraft/landscape';
import { deserializeProject, serializeProject, saveLocal, loadLocal } from '@openlandcraft/project';

const site = () => createSite({ name: 'Path test', width: 60, depth: 48, resolution: 129, preset: 'flat' });
describe('path authoring and compatibility', () => {
  it('rounds a finished landscape path in one undo step and saves its editable numbered anchors',async()=>{
    const p=site(),path=createDrawnPath(p,[[-18,0],[0,0],[0,18]],{width:2,surface:'paving'});p.entities=[path];
    const before=structuredClone(p),editor=new Editor(p);editor.begin('Round path corner');
    for(const amount of [.2,.5,1])editor.preview({type:'replace',entity:{...path,cornerRounding:[0,amount,0]}});
    expect(editor.getSnapshot().past).toHaveLength(0);editor.commit();expect(editor.getSnapshot().past).toHaveLength(1);
    const rounded=editor.getSnapshot().project,entity=rounded.entities[0] as Path;
    expect(entity.points).toEqual(path.points);expect(pathLength(roundedRoutePoints(entity))).toBeLessThan(36);
    expect(entity.surface).toBe('paving');expect(rounded.site.terrain).toEqual(before.site.terrain);
    expect(deserializeProject(serializeProject(rounded))).toEqual(rounded);await saveLocal(rounded);expect(await loadLocal()).toEqual(rounded);
    const blocked=plantingObstacle(rounded,{clearance:0,exclusions:{water:false,paths:true,buildings:false}});
    expect(blocked(0,0)).toBe(false);const curve=roundedRoutePoints(entity);expect(blocked(...curve[Math.floor(curve.length/2)])).toBe(true);
    editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();
    editor.begin('Round path corner');editor.preview({type:'replace',entity:path});editor.cancel();expect(editor.getSnapshot().project).toEqual(rounded);
    for(const cornerRounding of [[0,1],[1,0,0],[0,0,1],[0,1.01,0]])expect(()=>parseProject({...p,entities:[{...path,cornerRounding}]})).toThrow();
    const redrawn=createDrawnPath(rounded,[[-12,5],[14,5]],{width:2,surface:'timber'},path.id);expect(redrawn.cornerRounding).toBeUndefined();
  });
  it('commits only the route explicitly drawn, as one undo step', () => {
    const editor = new Editor(site()), before = editor.getSnapshot().project;
    const points:[number,number][] = [[-18,-8],[-5,-8],[4,2],[18,2]];
    const path = createDrawnPath(before,points,{width:3,surface:'paving'});
    expect(editor.getSnapshot().project).toBe(before); expect(before.entities).toHaveLength(0);
    expect(path.points).toEqual(points); expect(path.width).toBe(3); expect(path.surface).toBe('paving');
    editor.execute({type:'add',entity:path},'Draw path');
    expect(editor.getSnapshot().past).toHaveLength(1);
    const saved = deserializeProject(serializeProject(editor.getSnapshot().project));
    expect(saved.entities.find(e => e.id === path.id)).toEqual(path);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before);
    editor.redo(); expect(editor.getSnapshot().project.entities[0]).toEqual(path);
  });
  it('redraws an existing path without losing identity, layer or surface settings, and leaves canceled drafts untouched', () => {
    const p = site(), original = createPath(p,[[-15,-6],[12,-6]]); original.name = 'Garden walk'; original.width = 4; original.surface = 'timber';
    p.entities = [original]; p.objectLayers[original.id] = 'default';
    const editor = new Editor(p), before = editor.getSnapshot().project;
    const redrawn = createDrawnPath(before,[[-12,5],[0,5],[14,12]],original,original.id);
    // A drawing is local state until Finish: canceling it has no document/history effect.
    expect(editor.getSnapshot().project).toBe(before); expect(editor.getSnapshot().past).toHaveLength(0);
    expect(redrawn.id).toBe(original.id); expect(redrawn.name).toBe(original.name); expect(redrawn.surface).toBe('timber');
    editor.execute({type:'replace',entity:redrawn},'Redraw path');
    expect(editor.getSnapshot().project.entities).toHaveLength(1); expect(editor.getSnapshot().project.objectLayers).toEqual(before.objectLayers);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before);
    editor.redo(); expect(editor.getSnapshot().project.entities[0]).toEqual(redrawn);
    expect(editor.getSnapshot().project.site.terrain).toEqual(before.site.terrain);
  });
  it('rejects incomplete, invalid or unintended second drawings before changing the document', () => {
    const p = site(), before = structuredClone(p);
    for (const points of [[],[[0,0]],[[0,0],[10,0],[1,1]],[[-31,0],[20,0]],[[0,0],[NaN,5]]] as [number,number][][])
      expect(() => createDrawnPath(p,points,{width:3,surface:'gravel'})).toThrow();
    expect(p).toEqual(before);
    p.entities = [createPath(p)];
    expect(() => createDrawnPath(p,[[-10,0],[10,0]],{width:3,surface:'gravel'})).toThrow(/Redraw/);
    expect(() => createDrawnPath(p,[[-10,0],[10,0]],{width:3,surface:'gravel'},'missing')).toThrow(/no longer exists/);
  });
  it('migrates version 8 without changing water, terrain or source entities', () => {
    const source = structuredClone(legacy), current = parseProject(legacy);
    expect(current).toEqual({...source,version:18,layers:defaultLayers(),objectLayers:{},activeLayerId:"default"}); expect(legacy).toEqual(source);
    expect(() => parseProject({ ...current, version: 19 })).toThrow();
    expect(() => parseProject({ ...source, entities: [...source.entities, createPath(current)] })).toThrow();
  });
  it('rejects unsupported geometry, modes and second paths atomically', () => {
    const editor = new Editor(site()), path = createPath(editor.getSnapshot().project);
    editor.execute({ type: 'add', entity: path }, 'Path'); const before = editor.getSnapshot();
    for (const patch of [{ width: 9 }, { width: NaN }, { surface: 'asphalt' }, { elevationMode: 'fixed' }, { points: [[0, 0]] }, { points: [[0, 0], [0.2, 0]] }, { points: [[-31, 0], [29, 0]], width: 8 }, { points: [[-10,-10],[10,10],[-10,10],[10,-10]] }, { points: [[0,0],[10,0],[0,0]] }]) {
      expect(() => editor.execute({ type: 'replace', entity: { ...path, ...patch } as Path }, 'Invalid')).toThrow(); expect(editor.getSnapshot()).toBe(before);
    }
    expect(() => editor.execute({ type: 'add', entity: { ...path, id: 'second', visible: false } }, 'Second')).toThrow('one unbranched path');
  });
  it('accepts bounded miter turns and dimensions; rejects width overlap', () => {
    expect(pathIssue({ points: [[-10,0],[0,0],[0,10]], width: 2 }, site().site)).toBeNull();
    expect(pathLength([[-10,0],[0,0],[0,10]])).toBe(20);
    expect(pathIssue({ points: [[-10,0],[0,0],[0,4],[-10,4]], width: 8 }, site().site)).toBeTruthy();
    expect(pathIssue({ points: [[0,0],[10,0],[1,1]], width: 2 }, site().site)).toMatch(/sharp/);
  });
  it('snaps only enabled endpoints to visible rotated building anchors, otherwise the grid', () => {
    const project = site(); project.entities = createBuilding(project, 0, 0, 10, 6, 'pavilion');
    const level = project.entities[0]; if (level.kind !== 'level') throw new Error('level'); level.rotation = 90;
    expect(snapPathPoint(project, [0.2,-4.8], true)).toEqual({ point: expect.arrayContaining([expect.closeTo(0, 6), expect.closeTo(-5, 6)]), target: expect.any(String) });
    expect(snapPathPoint(project, [0.2,-4.8], false).point).toEqual([0.2,-4.8]);
    expect(snapPathPoint(project, [0.2,-4.8], true, false)).toEqual({ point:[0,-5], target:null });
    level.visible = false; expect(snapPathPoint(project, [0.2,-4.8], true).target).toBeNull();
  });
  it('previews one undo step, retains independent sculpting on hide/delete, and round trips', async () => {
    const editor = new Editor(site()), original = editor.getSnapshot().project, path = createPath(original);
    editor.execute({ type: 'add', entity: path }, 'Add path');
    const before = editor.getSnapshot().project;
    editor.begin('Edit path'); editor.preview({ type: 'replace', entity: { ...path, width: 3, surface: 'paving' } });
    expect(editor.getSnapshot().project).toBe(before); editor.cancel(); expect(editor.getSnapshot().project).toBe(before);
    editor.begin('Edit path'); for (const width of [2.5, 3, 3.5]) editor.preview({ type: 'replace', entity: { ...path, width, surface: 'timber' } }); editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(2); const edited = editor.getSnapshot().project;
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before); editor.redo(); expect(editor.getSnapshot().project).toEqual(edited);
    const stroke = new TerrainStroke(original.site.terrain, original.site, DEFAULT_BRUSH); stroke.move(...path.points[1]);
    editor.execute({ type: 'terrain', field: stroke.snapshot() }, 'Sculpt'); const sculpted = editor.getSnapshot().project;
    editor.execute({ type: 'remove', id: path.id }, 'Delete path'); expect(editor.getSnapshot().project.site.terrain).toEqual(sculpted.site.terrain);
    editor.undo(); const restored = editor.getSnapshot().project;
    expect(evaluateProject(restored).site.terrain).toEqual(sculpted.site.terrain);
    expect(deserializeProject(serializeProject(restored))).toEqual(restored); await saveLocal(restored); expect(await loadLocal()).toEqual(restored);
    expect(serializeProject(restored)).not.toContain('samples');
  });
});
