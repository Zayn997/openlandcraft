import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The curated characters use one skin split into flat-color material primitives.
 * Bake that palette into vertex colors: one skeleton/material draw per character,
 * including shadow/refraction passes. Preserve unfamiliar imported materials. */
export function combineCharacterSkin(root:THREE.Group):boolean {
  const meshes:THREE.Mesh[]=[];root.traverse(object=>{if(object instanceof THREE.Mesh)meshes.push(object);});
  if(meshes.length<2||!meshes.every((mesh):mesh is THREE.SkinnedMesh=>mesh instanceof THREE.SkinnedMesh))return false;
  const first=meshes[0] as THREE.SkinnedMesh,skins=meshes as THREE.SkinnedMesh[];
  const signature=(material:THREE.Material)=>{const {uuid,name,color,...properties}=material.toJSON();return JSON.stringify(properties);};
  const firstMaterial=first.material;
  if(!(firstMaterial instanceof THREE.MeshStandardMaterial))return false;
  const key=signature(firstMaterial);
  if(!skins.every(mesh=>mesh.parent===first.parent&&mesh.matrix.equals(first.matrix)&&mesh.bindMatrix.equals(first.bindMatrix)&&mesh.bindMode===first.bindMode
    &&mesh.skeleton.bones.length===first.skeleton.bones.length&&mesh.skeleton.bones.every((bone,i)=>bone===first.skeleton.bones[i]&&mesh.skeleton.boneInverses[i].equals(first.skeleton.boneInverses[i]))
    &&!Object.keys(mesh.geometry.morphAttributes).length&&!mesh.geometry.hasAttribute('color')
    &&mesh.material instanceof THREE.MeshStandardMaterial&&!Object.values(mesh.material).some(value=>value instanceof THREE.Texture)&&signature(mesh.material)===key))return false;
  const prepared=skins.map(mesh=>{
    const geometry=mesh.geometry.clone(),color=(mesh.material as THREE.MeshStandardMaterial).color,count=geometry.getAttribute('position').count,colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
  });
  const merged=mergeGeometries(prepared,false);prepared.forEach(geometry=>geometry.dispose());if(!merged)return false;
  const geometries=new Set(skins.map(mesh=>mesh.geometry)),materials=new Set(skins.map(mesh=>mesh.material as THREE.Material));
  const material=firstMaterial.clone();material.color.set(0xffffff);material.vertexColors=true;
  first.geometry=merged;first.material=material;first.computeBoundingBox();first.computeBoundingSphere();
  skins.slice(1).forEach(mesh=>mesh.removeFromParent());
  new Set(skins.slice(1).map(mesh=>mesh.skeleton)).forEach(skeleton=>{if(skeleton!==first.skeleton)skeleton.dispose();});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
  return true;
}
