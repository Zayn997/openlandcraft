import * as THREE from 'three';

/** Clip a sampled lake plane to its shoreline fringe, keeping shared edge vertices. */
export function clipWaterDomain(source:THREE.BufferGeometry,distance:(x:number,z:number)=>number) {
  const p=source.getAttribute('position'),index=source.index!,positions:number[]=[],indices:number[]=[],cache=new Map<string,number>();
  type Point={x:number;y:number;z:number;d:number;key:string};
  const point=(i:number):Point=>({x:p.getX(i),y:p.getY(i),z:p.getZ(i),d:distance(p.getX(i),p.getZ(i)),key:`v${i}`});
  const add=(v:Point)=>{let i=cache.get(v.key);if(i===undefined){i=positions.length/3;cache.set(v.key,i);positions.push(v.x,v.y,v.z);}return i;};
  for(let i=0;i<index.count;i+=3){
    const triangle=[0,1,2].map(n=>point(index.getX(i+n))),polygon:Point[]=[];
    // Three zero-distance shoreline vertices can enclose a dry concave corner.
    if(triangle.every(v=>v.d<=0)&&distance(triangle.reduce((sum,v)=>sum+v.x,0)/3,triangle.reduce((sum,v)=>sum+v.z,0)/3)<=0)continue;
    for(let n=0;n<3;n++){
      const a=triangle[n],b=triangle[(n+1)%3];
      if(a.d>=0)polygon.push(a);
      if((a.d>=0)!==(b.d>=0)){
        const t=a.d/(a.d-b.d);
        polygon.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,d:0,key:t<1e-8?a.key:t>1-1e-8?b.key:[a.key,b.key].sort().join(':')});
      }
    }
    const ids=polygon.map(add).filter((id,n,array)=>array.indexOf(id)===n);
    for(let n=1;n<ids.length-1;n++)indices.push(ids[0],ids[n],ids[n+1]);
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setIndex(indices);
  result.computeBoundingBox();result.computeBoundingSphere();return result;
}

/** Copy all surface attributes onto its open edges, including river flow and phase. */
export function waterBoundary(surface:THREE.BufferGeometry) {
  const index=surface.index!,edges=new Map<string,{a:number;b:number;count:number}>();
  for(let i=0;i<index.count;i+=3)for(let n=0;n<3;n++){
    const a=index.getX(i+n),b=index.getX(i+(n+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`,edge=edges.get(key);
    if(edge)edge.count++;else edges.set(key,{a,b,count:1});
  }
  const ids:number[]=[],bottom:number[]=[],indices:number[]=[];
  for(const {a,b,count} of edges.values())if(count===1){
    const i=ids.length;ids.push(a,b,a,b);bottom.push(0,0,1,1);
    indices.push(i+1,i,i+2,i+1,i+2,i+3);
  }
  const geometry=new THREE.BufferGeometry();geometry.userData.surfaceIds=ids;
  geometry.setAttribute('volumeBottom',new THREE.Float32BufferAttribute(bottom,1));geometry.setIndex(indices);
  updateWaterBoundary(geometry,surface);return geometry;
}
export function updateWaterBoundary(boundary:THREE.BufferGeometry,surface:THREE.BufferGeometry) {
  const ids=boundary.userData.surfaceIds as number[];
  for(const [name,attribute] of Object.entries(surface.attributes)){
    if(name==='volumeBottom')continue;
    let target=boundary.getAttribute(name) as THREE.BufferAttribute|undefined;
    if(!target){target=new THREE.Float32BufferAttribute(new Float32Array(ids.length*attribute.itemSize),attribute.itemSize);boundary.setAttribute(name,target);}
    ids.forEach((id,i)=>{for(let k=0;k<attribute.itemSize;k++)target!.setComponent(i,k,attribute.getComponent(id,k));});target.needsUpdate=true;
  }
}
