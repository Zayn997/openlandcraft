import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createSite,instancePosition,type Instance} from '@openlandcraft/core';
import {mirrorBatchInstances} from './mirror-instances';
import {instanceMatrix} from './instancing';
it('reflects geometry through a shared parent with positive per-instance matrices and terrain height from the authored location',()=>{
 const p=createSite({name:'Slope',width:40,depth:40,resolution:129,preset:'flat'});p.site.terrain.heights=p.site.terrain.heights.map((_,i)=>2+(i%129)/128);
 const e:Instance={id:'tree',name:'Tree mirror',parentId:'site',kind:'instance',visible:true,assetId:'tree',position:[8,.2,4],rotation:32,scale:[2,1,3],anchor:'terrain',mirrored:true},render=mirrorBatchInstances([e],p)[0],y=instancePosition(e,p)[1];
 expect(render.position).toEqual([-8,y,4]);expect(render.anchor).toBe('fixed');
 const parent=new THREE.Matrix4().makeScale(-1,1,1),matrix=instanceMatrix(render.position,render.rotation,render.scale,new THREE.Matrix4()),wanted=instanceMatrix([8,y,4],32,[2,1,3],new THREE.Matrix4()).multiply(parent);
 expect(matrix.determinant()).toBeGreaterThan(0);const actual=parent.multiply(matrix);actual.elements.forEach((v,i)=>expect(v).toBeCloseTo(wanted.elements[i],8));
 expect(e.position).toEqual([8,.2,4]);
});
