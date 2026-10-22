import * as THREE from 'three';

type InfluenceBounds={bind:THREE.Matrix4;boxes:THREE.Box3[]};
const cached=new WeakMap<THREE.BufferGeometry,InfluenceBounds[]>();

/** Skinning is a weighted sum: the union of transformed bone-influence boxes
 * contains every deformed vertex. Build the boxes once, sharing them across clones. */
function influenceBounds(mesh:THREE.SkinnedMesh):THREE.Box3[] | null {
  const {geometry,skeleton}=mesh;
  if(geometry.morphAttributes.position?.length)return null;
  const position=geometry.getAttribute('position'),indices=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  if(!position||!indices||!weights)return null;
  const entries=cached.get(geometry)??[],existing=entries.find(entry=>entry.boxes.length===skeleton.bones.length&&entry.bind.equals(mesh.bindMatrix));
  if(existing)return existing.boxes;
  const boxes=skeleton.bones.map(()=>new THREE.Box3()),point=new THREE.Vector3();
  for(let vertex=0;vertex<position.count;vertex++){
    point.fromBufferAttribute(position,vertex).applyMatrix4(mesh.bindMatrix);
    let sum=0;
    for(let influence=0;influence<4;influence++){
      const weight=weights.getComponent(vertex,influence),index=indices.getComponent(vertex,influence);
      // Fall back to exact bounds for unusual imported skins outside convex skinning.
      if(weight<0||!Number.isFinite(weight)||(weight>0&&!boxes[index]))return null;
      if(weight>0)boxes[index].expandByPoint(point);
      sum+=weight;
    }
    if(Math.abs(sum-1)>1e-4)return null;
  }
  entries.push({bind:mesh.bindMatrix.clone(),boxes});cached.set(geometry,entries);return boxes;
}

/** Refresh conservative bounds in O(bones), then keep Three's exact triangle pick.
 * Rays missing a character never skin its thousands of vertices. */
export function createAnimatedRaycast(mesh:THREE.Mesh):THREE.Mesh['raycast'] {
  const original=mesh.raycast;
  if(!(mesh instanceof THREE.SkinnedMesh))return original;
  const boxes=influenceBounds(mesh),matrix=new THREE.Matrix4(),transformed=new THREE.Box3();
  const bounds=mesh.boundingBox??new THREE.Box3(),sphere=mesh.boundingSphere??new THREE.Sphere();
  return function(raycaster,hits){
    if(boxes){
      bounds.makeEmpty();
      boxes.forEach((box,index)=>{
        if(box.isEmpty())return;
        matrix.multiplyMatrices(mesh.skeleton.bones[index].matrixWorld,mesh.skeleton.boneInverses[index]).premultiply(mesh.bindMatrixInverse);
        bounds.union(transformed.copy(box).applyMatrix4(matrix));
      });
      bounds.expandByScalar(0.001);bounds.getBoundingSphere(sphere);
      mesh.boundingBox=bounds;mesh.boundingSphere=sphere;
    }else{
      mesh.computeBoundingSphere();mesh.computeBoundingBox();
    }
    original.call(mesh,raycaster,hits);
  };
}
