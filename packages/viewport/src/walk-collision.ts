import { Box3, Mesh, Object3D, Raycaster, Vector3, type Intersection } from 'three';
import { groundHabitat, groundHeight, type Project } from '@openlandcraft/core';
import { WALK_RADIUS, type WalkEnvironment, type WalkPose } from './walk-motion';
import { experienceWaterSurface } from './experience-water';

/** Compile authored solid meshes once. Editor raycast overrides do not disable physical collisions. */
export function walkCollisionMeshes(scene: Object3D, project: Project): Mesh[] {
  const ids = new Set(project.entities.filter(entity => entity.visible && ['wall', 'slab', 'roof', 'block', 'path', 'materialRegion'].includes(entity.kind)).map(entity => entity.id));
  const meshes: Mesh[] = [];
  scene.updateMatrixWorld(true);
  scene.traverseVisible(object => {
    // drei Edges uses LineSegments2, which extends Mesh. Its triangles are a
    // screen-space line template, not solid world geometry: raycasting them as
    // a Mesh creates phantom barriers across openings at the parent's origin.
    if (!(object instanceof Mesh) || ('isLineSegments2' in object && object.isLineSegments2)) return;
    let parent: Object3D | null = object, id: string | undefined;
    while (parent) {
      if (parent.userData.waterCaptureExclude || parent.userData.experienceAvatar || parent.userData.experiencePassThrough) return;
      id ??= parent.userData.copyEntityId;
      parent = parent.parent;
    }
    if (id && ids.has(id)) meshes.push(object);
  });
  return meshes;
}

export function createWalkEnvironment(project: Project, meshes: Mesh[], height: number): WalkEnvironment & { obstructed: (start: Vector3, end: Vector3) => Vector3 } {
  const landscape = groundHabitat({ ...project, entities: project.entities.filter(entity => !['wall', 'slab', 'roof', 'block'].includes(entity.kind)) }, { water: false, terrain: false });
  const buckets = new Map<string, Mesh[]>(), oversized: Mesh[] = [], cell = 8;
  for (const mesh of meshes) {
    const box = new Box3().setFromObject(mesh);
    if (box.isEmpty()) continue;
    const x0 = Math.floor(box.min.x / cell), x1 = Math.floor(box.max.x / cell), z0 = Math.floor(box.min.z / cell), z1 = Math.floor(box.max.z / cell);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 1024) { oversized.push(mesh); continue; }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const key = `${x}:${z}`, items = buckets.get(key); if (items) items.push(mesh); else buckets.set(key, [mesh]);
    }
  }
  const candidates = (start: Vector3, end: Vector3, margin = 0) => {
    const values = new Set(oversized);
    for (let x = Math.floor((Math.min(start.x, end.x) - margin) / cell); x <= Math.floor((Math.max(start.x, end.x) + margin) / cell); x++)
      for (let z = Math.floor((Math.min(start.z, end.z) - margin) / cell); z <= Math.floor((Math.max(start.z, end.z) + margin) / cell); z++)
        for (const mesh of buckets.get(`${x}:${z}`) ?? []) values.add(mesh);
    return values;
  };
  const ray = new Raycaster(), origin = new Vector3(), target = new Vector3(), direction = new Vector3();
  const cast = (start: Vector3, end: Vector3, objects: Iterable<Mesh>): Intersection[] => {
    direction.subVectors(end, start); const length = direction.length();
    if (length < 1e-8) return [];
    ray.set(start, direction.divideScalar(length)); ray.near = 0; ray.far = length;
    const hits: Intersection[] = [];
    for (const mesh of objects) Mesh.prototype.raycast.call(mesh, ray, hits);
    return hits.sort((a, b) => a.distance - b.distance);
  };
  return {
    height,
    water: experienceWaterSurface(project),
    rise(from, toY) {
      let allowed = toY;
      for (const [dx, dz] of [[0, 0], [WALK_RADIUS, 0], [-WALK_RADIUS, 0], [0, WALK_RADIUS], [0, -WALK_RADIUS]]) {
        origin.set(from.x + dx, from.y + height - 0.08, from.z + dz);
        target.set(origin.x, toY + height + 0.04, origin.z);
        const hit = cast(origin, target, candidates(origin, target))[0];
        if (hit) allowed = Math.min(allowed, Math.max(from.y, hit.point.y - height - 0.04));
      }
      return allowed;
    },
    floor(x, z, ceiling) {
      const terrain = groundHeight(x, z, project.site);
      origin.set(x, ceiling + 0.01, z); target.set(x, -100, z);
      const hit = cast(origin, target, candidates(origin, origin)).find(hit => hit.face && hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y > 0.4);
      return Math.max(terrain, hit?.point.y ?? -100);
    },
    clear(from: WalkPose, x, z) {
      if (!landscape.clear(x, z, WALK_RADIUS)) return false;
      const dx = x - from.x, dz = z - from.z, distance = Math.hypot(dx, dz);
      if (distance < 1e-8) return true;
      const sx = -dz / distance * WALK_RADIUS * 0.85, sz = dx / distance * WALK_RADIUS * 0.85;
      origin.set(from.x, from.y, from.z); target.set(x, from.y + height, z);
      const objects = candidates(origin, target, WALK_RADIUS);
      for (const y of [0.45, height * 0.55, height - 0.08]) for (const side of [-1, 0, 1]) {
        origin.set(from.x + sx * side, from.y + y, from.z + sz * side);
        target.set(x + sx * side + dx / distance * WALK_RADIUS, from.y + y, z + sz * side + dz / distance * WALK_RADIUS);
        if (cast(origin, target, objects).length) return false;
      }
      return true;
    },
    obstructed(start, end) {
      const hit = cast(start, end, candidates(start, end, 0.1))[0];
      return hit ? start.clone().lerp(end, Math.max(0.05, (hit.distance - 0.18) / start.distanceTo(end))) : end;
    },
  };
}
