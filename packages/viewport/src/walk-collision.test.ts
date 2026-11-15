import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { createSite, createBuilding, createLake, defaultOpeningJoinery, createCurvedWall, wallLength, wallPathPoint, type Wall, type Opening } from '@openlandcraft/core';
import { buildWallGeometry } from './architecture-geometry';
import { buildOpeningComponentGeometry, type OpeningComponent } from './opening-joinery';
import { createWalkEnvironment, walkCollisionMeshes } from './walk-collision';
import { advanceWalk, type WalkPose } from './walk-motion';

function scene() {
  const project = createSite({ name: 'Walking collisions', width: 60, depth: 60, resolution: 129, preset: 'flat' });
  project.site.terrain.heights.fill(0); return project;
}
function box(width: number, height: number, depth: number, x: number, y: number, z: number) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), new MeshBasicMaterial());
  mesh.position.set(x, y, z); mesh.updateMatrixWorld();
  mesh.raycast = () => {}; // Editing is disabled in Explore, but physics must still see the object.
  return mesh;
}
const pose: WalkPose = { x: 0, y: 0, z: 2, yaw: 0, falling: 0, speed: 0 };

describe('Explore scene collisions', () => {
  it.each(['door', 'window'] as const)('passes through authored %s panels/glass with straight, rotated and curved wall openings', kind => {
    for (const curved of [false, true]) for (const rotation of [0, 0.7]) for (const shape of ['rectangle', 'arch'] as const) {
      const project = scene(); project.entities.push(...createBuilding(project, 0, 0, 8, 8));
      const level = project.entities.find(entity => entity.kind === 'level')!;
      const wall: Wall = curved ? createCurvedWall(level.id, 'circle', [[0,0],[6,0]], 0.3, 5, false, 0, 'walk-wall') : { ...project.entities.find((entity): entity is Wall => entity.kind === 'wall')!, id: 'walk-wall', start: [-4,0], end: [4,0], elevation: 0, height: 5, thickness: 0.3 };
      const opening: Opening = { id: 'entry', kind, offset: wallLength(wall) / 3, width: 2, height: 2.8, sill: kind === 'window' ? 0.8 : 0, shape, ...(shape === 'arch' ? { archRise: 0.6 } : {}), joinery: defaultOpeningJoinery(kind) };
      wall.openings = [opening]; project.entities = [level, wall];
      const root = new Group(); root.position.set(3,0,-2); root.rotation.y = rotation;
      const solid = new Mesh(buildWallGeometry(wall, [wall]), new MeshBasicMaterial()); solid.userData.copyEntityId = wall.id; root.add(solid);
      const frameMeshes: Mesh[] = [];
      for (const component of ['frame', 'panel', 'glass'] as OpeningComponent[]) if (opening.joinery?.[component]) {
        const mesh = new Mesh(buildOpeningComponentGeometry(wall, opening, component), new MeshBasicMaterial());
        mesh.userData = { copyEntityId: wall.id, copyOpeningId: opening.id, experiencePassThrough: component !== 'frame' }; root.add(mesh);
        if (component === 'frame') frameMeshes.push(mesh);
      }
      const meshes = walkCollisionMeshes(root, project); expect(meshes).toEqual([solid, ...frameMeshes]);
      const world = createWalkEnvironment(project, meshes, 1.78);
      const station = opening.offset + opening.width / 2;
      const point = (offset: number, lateral: number, y: number) => { const p = wallPathPoint(wall, offset / wallLength(wall), lateral); return root.localToWorld(new Vector3(p[0], y, p[1])); };
      for (const side of [-1,1]) {
        const start = point(station, side * 0.5, opening.sill + 0.16), end = point(station, side * 0.4, start.y);
        expect(world.clear({ ...pose, x: start.x, y: start.y, z: start.z }, end.x, end.z)).toBe(true);
        const jamb = point(opening.offset - 0.1, side * 0.5, start.y), blocked = point(opening.offset - 0.1, side * 0.4, start.y);
        expect(world.clear({ ...pose, x: jamb.x, y: jamb.y, z: jamb.z }, blocked.x, blocked.z)).toBe(false);
      }
      for (const mesh of root.children as Mesh[]) { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); }
    }
  });
  it('blocks solid walls with picking disabled and keeps the camera in front of them', () => {
    const wall = box(8, 3, 0.1, 0, 1.5, 0), world = createWalkEnvironment(scene(), [wall], 1.78);
    let next = { ...pose };
    for (let i = 0; i < 60; i++) next = advanceWalk(next, { forward: 1, right: 0, yaw: 0, running: true }, 1 / 30, world);
    expect(next.z).toBeGreaterThan(0.32); expect(next.z).toBeLessThan(0.5);
    const camera = world.obstructed(new Vector3(0, 1.5, 2), new Vector3(0, 1.5, -4));
    expect(camera.z).toBeCloseTo(0.23);
  });
  it('allows passage through actual doorway gaps while blocking their frames', () => {
    const meshes = [box(2, 3, 0.3, -1.75, 1.5, 0), box(2, 3, 0.3, 1.75, 1.5, 0), box(1.5, 0.7, 0.3, 0, 2.65, 0)];
    const world = createWalkEnvironment(scene(), meshes, 1.78);
    expect(world.clear({ ...pose, z: 0.4 }, 0, 0.2)).toBe(true);
    expect(world.clear({ ...pose, x: 1.2, z: 0.4 }, 1.2, 0.2)).toBe(false);
  });
  it('finds bridge and upper-floor surfaces without snapping up through ceilings', () => {
    const floor = box(8, 0.3, 8, 0, 2.85, 0), world = createWalkEnvironment(scene(), [floor], 1.68);
    expect(world.floor(0, 0, 3.34)).toBeCloseTo(3);
    expect(world.floor(0, 0, 0.34)).toBeCloseTo(0);
    expect(world.floor(12, 0, 3.34)).toBeCloseTo(0);
  });
  it('allows entering water to swim while respecting site edges', () => {
    const project = scene(), lake = createLake(project, [[-4,-4],[4,-4],[4,4],[-4,4]]); lake.level = 2; project.entities.push(lake);
    const world = createWalkEnvironment(project, [], 1.78);
    expect(world.clear({ ...pose, x: 5, z: 0 }, 4, 0)).toBe(true);
    expect(world.water!(0, 0)).not.toBeNull();
    expect(world.clear({ ...pose, x: 29, z: 0 }, 30, 0)).toBe(false);
  });
  it('stops jumps beneath a low ceiling even with editor picking disabled', () => {
    const roof = box(8, 0.2, 8, 0, 2.1, 0), world = createWalkEnvironment(scene(), [roof], 1.78);
    let next = { ...pose }, peak = 0;
    for (let i = 0; i < 100; i++) { next = advanceWalk(next, { forward: 0, right: 0, yaw: 0, running: false, jump: i === 0 }, 1 / 60, world); peak = Math.max(peak, next.y); }
    expect(peak).toBeGreaterThan(0.1); expect(peak + 1.78).toBeLessThan(2); expect(next.y).toBe(0);
  });
  it('keeps an explorer walking on a deck above water rather than switching to swimming', () => {
    const project = scene(), lake = createLake(project, [[-8,-8],[8,-8],[8,8],[-8,8]]); lake.level = 2; project.entities.push(lake);
    const world = createWalkEnvironment(project, [box(8, 0.3, 8, 0, 2.85, 0)], 1.78);
    const next = advanceWalk({ ...pose, y: 3 }, { forward: 1, right: 0, yaw: 0, running: false }, 1 / 30, world);
    expect(next.y).toBeCloseTo(3); expect(next.motion).toBe('ground');
  });
  it('collects only visible authored solid meshes, excluding avatar and helper geometry', () => {
    const project = scene(); project.entities.push(...createBuilding(project, 0, 0, 8, 8));
    const wall = project.entities.find(entity => entity.kind === 'wall')!;
    const root = new Group(), solid = new Group(); solid.userData.copyEntityId = wall.id; root.add(solid);
    const visible = box(1, 1, 1, 0, 0, 0), hidden = visible.clone(), helper = visible.clone();
    hidden.visible = false; helper.userData.waterCaptureExclude = true; solid.add(visible, hidden, helper);
    root.add(box(1, 1, 1, 0, 0, 0));
    expect(walkCollisionMeshes(root, project)).toEqual([visible]);
    solid.userData.experienceAvatar = true; expect(walkCollisionMeshes(root, project)).toEqual([]);
  });
});
