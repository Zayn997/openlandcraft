import { Camera, OrthographicCamera, Vector3 } from 'three';
import type { Project } from '@openlandcraft/core';

/** Conservative origin-centered envelope, computed only when authored data changes.
 * Avoid traversing rendered meshes (including animated/instanced models) while orbiting.
 */
export function orthographicSceneRadius(project: Project) {
  // Includes terrain closure, water, and the supported site/architecture elevations.
  let radius = Math.hypot(project.site.width / 2, 200, project.site.depth / 2);
  for (const entity of project.entities) {
    if (!entity.visible || !('position' in entity)) continue;
    const position = Math.hypot(...entity.position);
    if (entity.kind === 'block') radius = Math.max(radius, position + Math.hypot(...entity.size));
    // Level-local coordinates, heights, roofs and attached circulation fit inside 200 m.
    if (entity.kind === 'level') radius = Math.max(radius, position + 200);
    if (entity.kind === 'instance') {
      // Model loading accepts at most 200 m on each axis, normalized to bottom-center.
      // Include terrain anchoring and a margin for animated routes.
      radius = Math.max(radius, position + Math.hypot(100 * entity.scale[0], 200 * entity.scale[1], 100 * entity.scale[2]) + 200);
    }
  }
  return radius;
}

const direction = new Vector3();
/** Orthographic zoom changes the frustum, not camera distance. Keep the entire
 * editing scene in front of the near plane without changing its screen position/size.
 */
export function keepOrthographicSceneInFront(camera: Camera, target: Vector3, sceneRadius: number) {
  if (!(camera instanceof OrthographicCamera)) return;
  const extent = target.length() + sceneRadius;
  const padding = 10;
  const distance = camera.position.distanceTo(target);
  const required = extent + padding;
  if (distance < required) {
    camera.getWorldDirection(direction);
    camera.position.addScaledVector(direction, distance - required);
    camera.updateMatrixWorld();
  }
  const far = Math.max(1500, Math.max(distance, required) + extent + padding);
  if (camera.near !== 0.1 || camera.far !== far) {
    camera.near = 0.1;
    camera.far = far;
    camera.updateProjectionMatrix();
  }
}
