import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { applyCommand, createBuilding, createProject, createUnit, Editor, type Project } from '@openlandcraft/core';
import { DragCopy } from './drag-copy';

// Run the actual controller and Three.js raycasts with an in-memory canvas.
// Only React's hook lifecycle and the renderer context are replaced.
const hooks = vi.hoisted(() => ({ state: {} as Record<string, unknown>, cleanups: [] as (() => void)[] }));
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }), useEffect: (effect: () => () => void) => { hooks.cleanups.push(effect()); } }));
vi.mock('@react-three/fiber', () => ({ useThree: () => hooks.state }));

class Canvas extends EventTarget {
  style = { cursor: '' }; captures = new Set<number>();
  getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 200 }; }
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); }
}
function setup(options: { project?: Project; pickedId?: string; selectedId?: string; selectedIds?: string[]; openingId?: string } = {}) {
  const canvas = new Canvas(), scene = new THREE.Scene(), controls = { enabled: true };
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 20, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  mesh.userData = { copyEntityId: options.pickedId ?? 'block-pavilion', copyOpeningId: options.openingId }; scene.add(mesh);
  const editor = new Editor(options.project ?? createProject()), original = editor.getSnapshot().project;
  const onPlaced = vi.fn(), onStatus = vi.fn();
  hooks.state = { gl: { domElement: canvas }, camera, scene, controls };
  vi.stubGlobal('window', new EventTarget());
  DragCopy({ editor, enabled: true, selectedId: options.selectedId ?? null, selectedIds: options.selectedIds ?? [], snapping: true, onPlaced, onStatus });
  const pointer = (type: string, x = 100, y = 100, alt = true) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: 1, button: 0, clientX: x, clientY: y, altKey: alt });
    canvas.dispatchEvent(event); return event;
  };
  return { canvas, scene, mesh, editor, original, controls, pointer, onPlaced, onStatus };
}
afterEach(() => { hooks.cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

describe('Alt-drag pointer controller', () => {
  it('copies the massing box under the pointer rather than an invisible transform plane', () => {
    const s = setup();
    // Massing identifies its group, not the individual face mesh.
    const group = new THREE.Group(); group.userData.copyEntityId = 'block-pavilion';
    s.mesh.userData = {}; group.add(s.mesh); s.scene.add(group);
    const other = s.original.entities.find(e => e.kind === 'block' && e.id !== 'block-pavilion')!;
    // TransformControls keeps its huge plane object visible but hides the material.
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    plane.rotation.x = -Math.PI / 2; plane.position.y = 3;
    plane.userData.copyEntityId = other.id; s.scene.add(plane);
    s.pointer('pointerdown'); s.pointer('pointerup', 150);
    const copiedId = s.onPlaced.mock.calls[0][0].selectedIds[0];
    const copied = s.editor.getSnapshot().project.entities.find(e => e.id === copiedId)!;
    expect(copied.name).toBe('Pavilion 01 copy');
    expect(s.editor.getSnapshot().project.entities.find(e => e.id === 'block-pavilion')).toEqual(s.original.entities.find(e => e.id === 'block-pavilion'));
    s.pointer('pointerdown', 180, 180); s.pointer('pointerup', 190, 180);
    expect(s.onPlaced).toHaveBeenCalledTimes(1);
  });
  it('captures Alt-left down, previews at the pointer, commits once and restores orbit', () => {
    const s = setup();
    expect(s.pointer('pointerdown').defaultPrevented).toBe(true); expect(s.controls.enabled).toBe(false);
    s.pointer('pointermove', 140); s.pointer('pointermove', 150);
    expect(s.editor.getSnapshot().project).toBe(s.original); expect(s.editor.getSnapshot().past).toHaveLength(0);
    expect(s.editor.getSnapshot().preview!.entities.length).toBe(s.original.entities.length + 1);
    s.pointer('pointerup', 150);
    const id = s.onPlaced.mock.calls[0][0].selectedIds[0];
    const copy = s.editor.getSnapshot().project.entities.find(e => e.id === id)!;
    const source = s.original.entities.find(e => e.id === 'block-pavilion')!;
    expect(copy.kind === 'block' && source.kind === 'block' && copy.position).toEqual(source.kind === 'block' && [source.position[0] + 5, source.position[1], source.position[2]]);
    expect(s.editor.getSnapshot().project.entities.find(e => e.id === source.id)).toEqual(source);
    expect(s.editor.getSnapshot().past).toHaveLength(1); expect(s.controls.enabled).toBe(true); expect(s.canvas.captures.size).toBe(0);
    s.editor.undo(); expect(s.editor.getSnapshot().project).toEqual(s.original);
    s.editor.redo(); expect(s.editor.getSnapshot().project.entities.some(e => e.id === id)).toBe(true);
  });
  it('leaves normal drags alone and creates nothing on an Alt-click or zero-distance drop', () => {
    const s = setup(); expect(s.pointer('pointerdown', 100, 100, false).defaultPrevented).toBe(false);
    s.pointer('pointerdown'); s.pointer('pointerup');
    s.pointer('pointerdown'); s.pointer('pointermove', 150); s.pointer('pointerup', 100);
    expect(s.editor.getSnapshot().project).toEqual(s.original); expect(s.editor.getSnapshot().past).toHaveLength(0); expect(s.onPlaced).not.toHaveBeenCalled();
  });
  it('copies a selected massing box from its face with its dimensions, rotation and color intact', () => {
    const s = setup({ selectedId: 'block-pavilion' });
    s.pointer('pointerdown'); s.pointer('pointerup', 150);
    const copy = s.editor.getSnapshot().project.entities.find(e => e.id === s.onPlaced.mock.calls[0][0].selectedIds[0])!;
    const source = s.original.entities.find(e => e.id === 'block-pavilion')!;
    expect(copy.kind).toBe('block');
    if (copy.kind !== 'block' || source.kind !== 'block') throw new Error('Expected massing blocks');
    expect(copy.size).toEqual(source.size); expect(copy.rotation).toBe(source.rotation); expect(copy.color).toBe(source.color);
    expect(s.editor.getSnapshot().past).toHaveLength(1);
  });
  it.each(['Escape', 'blur', 'pointercancel', 'lostpointercapture'])('cancels on %s without leaving a copy or disabled controls', reason => {
    const s = setup(); s.pointer('pointerdown'); s.pointer('pointermove', 150);
    if (reason === 'Escape') window.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
    else if (reason === 'blur') window.dispatchEvent(new Event('blur'));
    else s.canvas.dispatchEvent(new Event(reason));
    s.pointer('pointerup', 150);
    expect(s.editor.getSnapshot().project).toEqual(s.original); expect(s.editor.getSnapshot().preview).toBeNull(); expect(s.editor.getSnapshot().past).toHaveLength(0);
    expect(s.controls.enabled).toBe(true); expect(s.canvas.captures.size).toBe(0); expect(s.onPlaced).not.toHaveBeenCalled();
  });
  it('copies a selected unit including its group record when dragging a member', () => {
    const site = createProject(), parts = createBuilding(site, -24, 4, 12, 8, 'floor');
    let project = applyCommand(site, { type: 'insert', entities: parts });
    const ids = parts.filter(e => e.parentId === 'floor').map(e => e.id);
    project = applyCommand(project, { type: 'add', entity: createUnit(project, ids, 'Suite', 'unit') });
    const s = setup({ project, pickedId: ids[0], selectedId: 'unit', selectedIds: ids });
    s.pointer('pointerdown'); s.pointer('pointerup', 150);
    const selected = s.onPlaced.mock.calls[0][0].selectedIds;
    expect(selected).toHaveLength(1);
    const unit = s.editor.getSnapshot().project.entities.find(e => e.id === selected[0]);
    expect(unit?.kind).toBe('unit'); expect(unit?.kind === 'unit' && unit.memberIds).toHaveLength(ids.length);
  });
  it('rejects an invalid opening drop even after a valid preview', () => {
    const site = createProject(), parts = createBuilding(site, -24, 4, 12, 8, 'floor');
    const wall = parts.find(e => e.kind === 'wall')!;
    wall.openings = [{ id: 'window', kind: 'window', offset: 1, width: 1.2, height: 1.1, sill: 1 }];
    const project = applyCommand(site, { type: 'insert', entities: parts });
    const s = setup({ project, pickedId: wall.id, openingId: 'window' });
    s.mesh.material.transparent = true; s.mesh.material.opacity = 0;
    s.pointer('pointerdown'); s.pointer('pointermove', 150);
    expect(s.editor.getSnapshot().preview!.entities.find(e => e.id === wall.id)).not.toEqual(wall);
    s.pointer('pointerup', 100);
    expect(s.editor.getSnapshot().project).toEqual(s.original); expect(s.editor.getSnapshot().past).toHaveLength(0); expect(s.onPlaced).not.toHaveBeenCalled();
  });
});
