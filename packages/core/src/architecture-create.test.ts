import { describe, expect, it } from 'vitest';
import { createDrawnSurface, createSite, createWallChain, drawingPoint, Editor, footprint, parseProject, type Level, type PlanPoint } from './index';
import { deserializeProject, serializeProject } from '@openlandcraft/project';

const level: Level = { id: 'upper', kind: 'level', parentId: 'site', name: 'Upper level', visible: true, position: [10, 7, -8], rotation: 90 };
const outline: PlanPoint[] = [[0,0],[6,0],[6,2],[3,2],[3,5],[0,5]];
const scene = () => parseProject({ ...createSite({name:'Drawing',width:60,depth:60,resolution:129,preset:'flat'}), entities:[level] });

describe('tool-first architecture creation', () => {
  it('converts world hits to level-local coordinates without using terrain elevation', () => {
    const point = drawingPoint(level, 12, -12);
    expect(point[0]).toBeCloseTo(4); expect(point[1]).toBeCloseTo(2);
    const surface = createDrawnSurface('floor', level, outline, 0.3, 0.2);
    expect(footprint(surface)).toEqual(outline);
    expect(surface.parentId).toBe('upper'); expect(surface.elevation).toBe(0.3);
  });
  it.each(['floor','roof'] as const)('commits a concave %s as one undo step and preserves it in portable storage', kind => {
    const project = scene(), editor = new Editor(project);
    const entity = createDrawnSurface(kind, level, outline, kind==='roof'?3.4:0, 0.25);
    editor.execute({type:'add',entity}, `Draw ${kind}`);
    const drawn=editor.getSnapshot().project;
    expect(editor.getSnapshot().past).toHaveLength(1);
    expect(footprint(drawn.entities.find(e=>e.id===entity.id) as typeof entity)).toEqual(outline);
    expect(deserializeProject(serializeProject(drawn))).toEqual(drawn);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
    editor.redo(); expect(editor.getSnapshot().project).toEqual(drawn);
  });
  it('rejects crossing outlines and invalid thickness without changing the project or history', () => {
    const editor = new Editor(scene()), before = editor.getSnapshot();
    expect(()=>createDrawnSurface('floor',level,[[0,0],[5,5],[0,5],[5,0]],0,0.2)).toThrow();
    expect(()=>editor.execute({type:'add',entity:createDrawnSurface('roof',level,outline,3.4,-1)},'Invalid')).toThrow();
    expect(editor.getSnapshot()).toBe(before);
  });
  it('does not resnap an unsnapped wall draft when finishing', () => {
    const project=scene(), points:PlanPoint[]=[[0.13,0.17],[4.23,2.19]];
    const walls=createWallChain(project,level.id,points,false,'drawn',false);
    expect(walls[0].start).toEqual(points[0]); expect(walls[0].end).toEqual(points[1]);
    const editor=new Editor(project); editor.execute({type:'insert',entities:walls},'Draw wall');
    expect(editor.getSnapshot().past).toHaveLength(1); editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
  });
});
