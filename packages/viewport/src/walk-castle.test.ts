/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BoxGeometry, DoubleSide, EdgesGeometry, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { evaluateProject, parseProject, groundHeight, type Wall } from '@openlandcraft/core';
import { bridgeHeight, bridgeStation, terrainTriangleHeight } from '@openlandcraft/landscape';
import { buildPartGeometry } from './architecture-geometry';
import { buildOpeningComponentGeometry, type OpeningComponent } from './opening-joinery';
import { buildPathMesh, PATH_LIFT } from './path-geometry';
import { bridgeShell } from './bridge';
import { walkCollisionMeshes, createWalkEnvironment } from './walk-collision';
import { advanceWalk, type WalkPose } from './walk-motion';

describe('walking into the Three Wards gate', () => {
  it.each([1.68, 1.78])('crosses the bridge, gate and stairs in both directions for a %sm explorer', height => {
    const project = evaluateProject(parseProject(JSON.parse(readFileSync(new URL('../../../examples/alderwick-three-wards.olc.json', import.meta.url), 'utf8'))));
    const scene = new Group(), material = new MeshBasicMaterial({ side: DoubleSide });
    const outlineMaterial = new LineMaterial();
    for (const entity of project.entities) {
      if (!entity.visible) continue;
      const group = new Group(); group.userData.copyEntityId = entity.id; scene.add(group);
      if (entity.kind === 'wall' || entity.kind === 'slab' || entity.kind === 'roof') {
        const level = project.entities.find(level => level.id === entity.parentId);
        if (level?.kind !== 'level') continue;
        group.position.fromArray(level.position); group.rotation.y = level.rotation * Math.PI / 180;
        const walls = project.entities.filter((part): part is Wall => part.kind === 'wall' && part.parentId === level.id);
        const solid = new Mesh(buildPartGeometry(entity, walls), material);
        group.add(solid);
        // Match the drei Edges children rendered by BuildingLevel, including their Mesh base class.
        const edges = new EdgesGeometry(solid.geometry);
        const outline = new LineSegments2(new LineSegmentsGeometry().setPositions(edges.attributes.position.array as Float32Array), outlineMaterial);
        outline.raycast = () => {}; solid.add(outline); edges.dispose();
        if (entity.kind === 'wall') for (const opening of entity.openings ?? []) for (const component of ['frame','panel','glass'] as OpeningComponent[]) if (opening.joinery?.[component]) {
          const mesh = new Mesh(buildOpeningComponentGeometry(entity, opening, component), material); mesh.userData.experiencePassThrough = component !== 'frame'; group.add(mesh);
        }
      } else if (entity.kind === 'path') {
        group.add(new Mesh(buildPathMesh(entity, project.site).geometry, material));
        if (entity.bridge) {
          group.add(new Mesh(bridgeShell(entity, project.site), material));
          // Include BridgeStructure's abutments, posts and top rails, not just the deck.
          const b = entity.bridge, { length, tx, tz } = bridgeStation(entity, entity.points[0]);
          const at = (s: number, c: number) => {
            const x = entity.points[0][0] + tx * s - tz * c, z = entity.points[0][1] + tz * s + tx * c;
            return new Vector3(x, bridgeHeight(entity, project.site, [x,z]) + PATH_LIFT, z);
          };
          for (const s of [b.approachLength, length - b.approachLength]) {
            const p = at(s, 0), base = Math.min(...[-entity.width/2,entity.width/2].map(c => { const q = at(s,c); return terrainTriangleHeight(project.site,[q.x,q.z]); })) - 0.3;
            const top = entity.elevation! - b.thickness + PATH_LIFT;
            const mesh = new Mesh(new BoxGeometry(b.abutmentLength, Math.max(0.1, top-base), entity.width+0.4), material);
            mesh.position.set(p.x, (base+top)/2, p.z); mesh.rotation.y = -Math.atan2(tz,tx); group.add(mesh);
          }
          if (b.railingHeight > 0) for (const side of [-1,1]) {
            const across = side * (entity.width/2-0.08), count = Math.ceil(length/1.5);
            for (let i = 0; i <= count; i++) {
              const mesh = new Mesh(new BoxGeometry(0.12,b.railingHeight,0.12), material);
              mesh.position.copy(at(i*length/count,across)); mesh.position.y += b.railingHeight/2; group.add(mesh);
            }
            const stations = [0,b.approachLength,length-b.approachLength,length];
            for (let i = 1; i < stations.length; i++) {
              const a = at(stations[i-1],across), end = at(stations[i],across);
              a.y += b.railingHeight; end.y += b.railingHeight;
              const vector = end.clone().sub(a), mesh = new Mesh(new BoxGeometry(0.14,0.14,vector.length()),material);
              mesh.position.copy(a).add(end).multiplyScalar(0.5);
              mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0,0,1),vector.normalize())); group.add(mesh);
            }
          }
        }
      }
    }
    const meshes = walkCollisionMeshes(scene, project);
    expect(meshes.every(mesh => !(mesh instanceof LineSegments2))).toBe(true);
    const world = createWalkEnvironment(project, meshes, height);
    let pose: WalkPose = { x: 3, z: 45, y: world.floor(3,45,9), yaw: 0, falling: 0, speed: 0, motion: 'ground' };
    const reach = (x: number, z: number) => {
      for (let frame = 0; frame < 1800 && Math.hypot(x - pose.x, z - pose.z) > 0.06; frame++) {
        const dx = x - pose.x, dz = z - pose.z;
        const next = advanceWalk(pose, { forward: 1, right: 0, yaw: Math.atan2(-dx,-dz), running: false }, 1 / 60, world);
        const message = JSON.stringify({ target:[x,z], pose, ground:groundHeight(pose.x,pose.z,project.site), nextFloor:world.floor(next.x,next.z,pose.y+.34) });
        expect(Math.hypot(next.x-pose.x,next.z-pose.z), message).toBeGreaterThan(0.00001);
        pose = next;
      }
      expect(Math.hypot(x - pose.x, z - pose.z)).toBeLessThan(0.07);
    };
    try {
      reach(-2,25); reach(-2,22); reach(4.02,9.96); expect(pose.y).toBeGreaterThan(16.7);
      reach(-2,22); reach(-2,25); reach(3,45);
      expect(pose.y).toBeCloseTo(8.16 + PATH_LIFT, 2);
      // The open arch is traversable, but its jamb and the bridge railing stay solid.
      expect(world.clear({ ...pose, x: -4, y: 7.835, z: 24.2 }, -4, 24)).toBe(false);
      const bridge = project.entities.find(entity => entity.id === 'lower-bridge');
      if (bridge?.kind !== 'path') throw new Error('Missing bridge fixture');
      const { tx, tz } = bridgeStation(bridge, bridge.points[0]);
      const railingPose = { ...pose, x: 3 - tz * 1.1, z: 45 + tx * 1.1 };
      // Isolate the mesh collision check from the pedestrian route's plan-only edge guard.
      const solidWorld = createWalkEnvironment({ ...project, entities: project.entities.filter(entity => entity.id !== bridge.id) }, meshes, height);
      expect(solidWorld.clear(railingPose, railingPose.x - tz * 0.2, railingPose.z + tx * 0.2)).toBe(false);
    }
    finally { scene.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); }); material.dispose(); outlineMaterial.dispose(); }
  });
});
