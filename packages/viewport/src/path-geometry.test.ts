import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSite, createPath, parseProject, evaluateProject, type River } from '@openlandcraft/core';
import legacy from '../../../examples/river-water-study.olc.json';
import { buildPathMesh, PATH_LIFT, updatePathHeights } from './path-geometry';
import { intersectTerrain } from './terrain-picking';

describe('terrain-conforming paths', () => {
  it('matches rendered terrain triangles on rough ground, including inside path faces', () => {
    const project = createSite({ name: 'Rough', width: 20, depth: 20, resolution: 129, preset: 'flat' });
    project.site.terrain.heights = project.site.terrain.heights.map((_, i) => 2 + Math.sin(i * 0.8) * 0.7);
    const mesh = buildPathMesh(createPath(project, [[-8,-6],[-2,1],[7,5]]), project.site), positions = mesh.geometry.getAttribute('position');
    let tested = 0;
    for (let i = 0; i < positions.count; i += 51) {
      const p = new THREE.Vector3();
      for (let j = 0; j < 3; j++) p.add(new THREE.Vector3().fromBufferAttribute(positions, i+j)); p.multiplyScalar(1/3);
      const hit = intersectTerrain(new THREE.Ray(new THREE.Vector3(p.x,40,p.z),new THREE.Vector3(0,-1,0)),project.site)!;
      expect(p.y - hit.point.y).toBeCloseTo(PATH_LIFT, 4); tested++;
    }
    expect(tested).toBeGreaterThan(20); expect(positions.count).toBeLessThan(50000); mesh.geometry.dispose();
  });
  it('updates heights after river carving and hiding without rebuilding topology or changing authored data', () => {
    const project = parseProject(legacy), before = structuredClone(project), river = project.entities.find((e): e is River => e.kind === 'river')!;
    const [x,,z] = river.points[1], path = createPath(project, [[x-8,z],[x+8,z]]);
    const evaluated = evaluateProject(project), mesh = buildPathMesh(path,evaluated.site), geometry = mesh.geometry, positions = geometry.getAttribute('position');
    const carved = Array.from(positions.array);
    updatePathHeights(mesh, project.site); expect(mesh.geometry).toBe(geometry); expect(Array.from(positions.array)).not.toEqual(carved);
    updatePathHeights(mesh,evaluated.site); expect(Array.from(positions.array)).toEqual(carved); expect(project).toEqual(before);
    geometry.dispose();
  });
  it('covers a right-angle route exactly once with no overlapping join surface', () => {
    const project = createSite({ name:'Join', width:40,depth:40,resolution:129,preset:'flat' });
    const mesh = buildPathMesh(createPath(project,[[-10,0],[0,0],[0,10]]),project.site), positions=mesh.geometry.getAttribute('position');
    let area=0;
    for(let i=0;i<positions.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(positions,i),b=new THREE.Vector3().fromBufferAttribute(positions,i+1),c=new THREE.Vector3().fromBufferAttribute(positions,i+2);area+=b.sub(a).cross(c.sub(a)).length()/2;}
    expect(area).toBeCloseTo(40,4); mesh.geometry.dispose();
  });
});
