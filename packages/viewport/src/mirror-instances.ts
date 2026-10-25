import {instancePosition,type Instance,type Project} from '@openlandcraft/core';

/** Reflect the shared parent, leaving every InstancedMesh instance matrix with
 * positive determinant. Terrain Y is evaluated at the authored world position. */
export function mirrorBatchInstances(instances:Instance[],project:Project):Instance[]{
 return instances.map(e=>{const p=instancePosition(e,project);return {...e,position:[-p[0],p[1],p[2]],rotation:-e.rotation,anchor:'fixed'};});
}
