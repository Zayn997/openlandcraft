import * as THREE from 'three';
import {ccwPlan,floorEdgeSegments,footprint,signedPlanArea,subtractFloorCut,type PlanPoint,type Slab} from '@openlandcraft/core';
import {lakeDistance} from '@openlandcraft/landscape';
/** Cap triangles are clipped against shafts; boundary faces are emitted only on
 * actual floor/shaft edges, including shafts crossing an outline boundary. */
export function buildFloorGeometry(floor:Slab):THREE.BufferGeometry{
 const outline=ccwPlan(footprint(floor)),cuts=(floor.stairOpenings??[]).map(c=>ccwPlan(c.points)),vertices:number[]=[],bottom=floor.elevation,top=bottom+floor.thickness;
 const triangle=(a:PlanPoint,b:PlanPoint,c:PlanPoint,y:number,up:boolean)=>{const points=[a,b,c];if((signedPlanArea(points)>0)===up)points.reverse();for(const p of points)vertices.push(p[0],y,p[1]);};
 const triangles=THREE.ShapeUtils.triangulateShape(outline.map(p=>new THREE.Vector2(...p)),[]);
 for(const indices of triangles){let pieces=[indices.map(i=>outline[i])];for(const cut of cuts)pieces=pieces.flatMap(piece=>subtractFloorCut(piece,cut));for(const piece of pieces)for(let i=2;i<piece.length;i++){triangle(piece[0],piece[i-1],piece[i],top,true);triangle(piece[0],piece[i-1],piece[i],bottom,false);}}
 const side=(a:PlanPoint,b:PlanPoint,hole:boolean)=>{const points=[[a[0],bottom,a[1]],[b[0],bottom,b[1]],[b[0],top,b[1]],[a[0],top,a[1]]];for(const i of hole?[0,1,2,0,2,3]:[0,2,1,0,3,2])vertices.push(...points[i]);};
 const middle=(a:PlanPoint,b:PlanPoint):PlanPoint=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
 for(let i=0;i<outline.length;i++)for(const [a,b] of floorEdgeSegments(outline[i],outline[(i+1)%outline.length],cuts)){const p=middle(a,b);if(!cuts.some(c=>lakeDistance(c,...p)>-1e-8))side(a,b,false);}
 for(const cut of cuts)for(let i=0;i<cut.length;i++)for(const [a,b] of floorEdgeSegments(cut[i],cut[(i+1)%cut.length],[outline]))if(lakeDistance(outline,...middle(a,b))>1e-8)side(a,b,true);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
