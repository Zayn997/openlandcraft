import * as THREE from 'three';
import { subtractRanges,wallAccessRanges,wallWalkProfile,battlementLayout,curvedCapSlices,isCircularWall,mixedWallCap,openingSamples,openingTop,wallBodySamples,wallFootprint,wallLength,wallPathPoint,wallProfileOpenings,type Opening,type Wall } from '@openlandcraft/core';

type Point=[number,number,number];
/** One distance/height/depth mapping is used by cuts, previews, picking and handles. */
export function wallProfilePosition(w:Wall,x:number,y:number,lateral=0,walls:Wall[]=[w]):Point{
  const length=wallLength(w),end=Math.abs(x)<1e-7?'start':Math.abs(x-length)<1e-7?'end':null;
  let p=wallPathPoint(w,x/length,lateral);
  if(end){const cap=mixedWallCap(w,end,lateral,walls);
    if(cap)p=cap;
    else if(!w.curve){const poly=wallFootprint(w,walls),t=lateral/w.thickness+.5,a=end==='start'?poly[0]:poly[1],b=end==='start'?poly[3]:poly[2],d=(a[0]*(1-t)+b[0]*t)/length;p=wallPathPoint(w,d,lateral);}
  }
  return [p[0],w.elevation+y,p[1]];
}
export function wallSurfaceBuilder(w:Wall,walls:Wall[],rawPath=false){
  const vertices:number[]=[];
  const quad=(points:[Point,Point,Point,Point],reverse=false)=>{
    const order=reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3];
    for(const i of order)vertices.push(...points[i]);
  };
  const p=(x:number,y:number,d:number):Point=>{if(!rawPath)return wallProfilePosition(w,x,y,d,walls);const q=wallPathPoint(w,x/wallLength(w),d);return [q[0],w.elevation+y,q[1]];};
  const finish=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;};
  return {quad,p,finish};
}
/** Construct solid bands around the same opening profiles for straight and curved hosts.
 * Slices include arc samples and every aperture edge, so no triangle bridges a cut. */
export function buildWallProfileGeometry(w:Wall,walls:Wall[]):THREE.BufferGeometry{
  const {quad,p,finish}=wallSurfaceBuilder(w,walls),half=w.thickness/2,depths=curvedCapSlices(w,walls),xs=wallBodySamples(w,walls),openings=wallProfileOpenings(w),length=wallLength(w);
  for(let i=1;i<xs.length;i++){
    const a=xs[i-1],b=xs[i];if(b-a<1e-9)continue;
    const holes=openings.filter(o=>o.offset<(a+b)/2&&o.offset+o.width>(a+b)/2).sort((u,v)=>u.sill-v.sill);
    let lowA=0,lowB=0;
    const band=(highA:number,highB:number)=>{
      if(highA-lowA<1e-9&&highB-lowB<1e-9)return;
      for(const side of [-half,half])quad([p(a,lowA,side),p(b,lowB,side),p(b,highB,side),p(a,highA,side)],side<0);
      for(let j=1;j<depths.length;j++){
        const c=depths[j-1],d=depths[j];
        quad([p(a,lowA,c),p(b,lowB,c),p(b,lowB,d),p(a,lowA,d)]);
        quad([p(a,highA,c),p(b,highB,c),p(b,highB,d),p(a,highA,d)],true);
      }
    };
    for(const hole of holes){band(hole.sill,hole.sill);lowA=openingTop(hole,a);lowB=openingTop(hole,b);}
    band(w.height,w.height);
  }
  const cap=(x:number,low:number,high:number,reverse:boolean)=>{for(let j=1;j<depths.length;j++)quad([p(x,low,depths[j-1]),p(x,low,depths[j]),p(x,high,depths[j]),p(x,high,depths[j-1])],reverse);};
  if(!isCircularWall(w)){cap(0,0,w.height,false);cap(wallLength(w),0,w.height,true);}
  for(const o of openings){if(o.offset>=0&&o.offset<=length)cap(o.offset,o.sill,openingTop(o,o.offset),true);if(o.offset+o.width>=0&&o.offset+o.width<=length)cap(o.offset+o.width,o.sill,openingTop(o,o.offset+o.width),false);}
  return finish();
}
/** The actual empty volume doubles as the existing tools' preview / selection target. */
export function buildOpeningGeometry(w:Wall,o:Opening,topView=false):THREE.BufferGeometry{
  const {quad,p,finish}=wallSurfaceBuilder(w,[w]),half=w.thickness/2+(topView ? .175 : .04),xs=openingSamples(o);
  if(w.curve){const n=Math.ceil(o.width/w.curve.radius/(Math.PI/60));for(let i=1;i<n;i++)xs.push(o.offset+o.width*i/n);xs.sort((a,b)=>a-b);}
  const low=topView?w.height+.02:o.sill,top=(x:number)=>topView?w.height+.22:openingTop(o,x);
  for(let i=1;i<xs.length;i++){const a=xs[i-1],b=xs[i];if(b-a<1e-9)continue;
    for(const d of [-half,half])quad([p(a,low,d),p(b,low,d),p(b,top(b),d),p(a,top(a),d)],d<0);
    quad([p(a,low,-half),p(b,low,-half),p(b,low,half),p(a,low,half)]);
    quad([p(a,top(a),-half),p(b,top(b),-half),p(b,top(b),half),p(a,top(a),half)],true);
  }
  for(const [x,reverse] of [[o.offset,false],[o.offset+o.width,true]] as const)quad([p(x,low,-half),p(x,low,half),p(x,top(x),half),p(x,top(x),-half)],reverse);
  return finish();
}

/** Merlons use the same sampled path and wall faces as the host, including curved caps. */
export function buildBattlementGeometry(w:Wall,walls:Wall[]):THREE.BufferGeometry{
  const {quad,p,finish}=wallSurfaceBuilder(w,walls,!!w.walk),low=w.height,high=low+(w.battlements?.height??0);
  const profile=w.walk?wallWalkProfile(w):null;
  const depths=profile?[profile.side*profile.outer,profile.side*profile.parapetInner].sort((a,b)=>a-b):curvedCapSlices(w,walls);
  const left=depths[0],right=depths[depths.length-1];
  for(const [start,end] of battlementLayout(w).spans.flatMap(([a,b])=>subtractRanges(a,b,wallAccessRanges(w,'outer').map(([c,d])=>[c*wallLength(w),d*wallLength(w)])))){
    const steps=w.curve?Math.max(1,Math.ceil((end-start)/w.curve.radius/(Math.PI/60))):1;
    for(let i=0;i<steps;i++){
      const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;
      for(const side of [left,right])quad([p(a,low,side),p(b,low,side),p(b,high,side),p(a,high,side)],side===left);
      for(let j=1;j<depths.length;j++){
        const c=depths[j-1],d=depths[j];
        quad([p(a,low,c),p(b,low,c),p(b,low,d),p(a,low,d)]);
        quad([p(a,high,c),p(b,high,c),p(b,high,d),p(a,high,d)],true);
      }
    }
    for(const [x,reverse] of [[start,false],[end,true]] as const)for(let j=1;j<depths.length;j++)quad([p(x,low,depths[j-1]),p(x,low,depths[j]),p(x,high,depths[j]),p(x,high,depths[j-1])],reverse);
  }
  return finish();
}

/** Closed deck and continuous parapet bands; the wall below is shortened to the deck underside. */
export function buildWallWalkGeometry(w:Wall,walls:Wall[]):THREE.BufferGeometry{
  const {quad,p,finish}=wallSurfaceBuilder(w,walls,true);
  if(!w.walk)return finish();
  const {outer,parapetInner,inner,side,bottom,deckTop}=wallWalkProfile(w),length=wallLength(w);
  const steps=w.curve?Math.ceil(Math.abs(w.curve.sweepAngle)/3):1;
  const band=(from:number,to:number,low:number,high:number,spans:[number,number][]=[[0,1]])=>{
    for(const [start,end] of spans){const segments=Math.max(1,Math.ceil(steps*(end-start)));
    const [left,right]=[side*from,side*to].sort((a,b)=>a-b);
    for(let i=0;i<segments;i++){
      const a=length*(start+(end-start)*i/segments),b=length*(start+(end-start)*(i+1)/segments);
      for(const d of [left,right])quad([p(a,low,d),p(b,low,d),p(b,high,d),p(a,high,d)],d===left);
      quad([p(a,low,left),p(b,low,left),p(b,low,right),p(a,low,right)]);
      quad([p(a,high,left),p(b,high,left),p(b,high,right),p(a,high,right)],true);
    }
    if(!isCircularWall(w)||start!==0||end!==1)for(const [x,reverse] of [[start*length,false],[end*length,true]] as const)quad([p(x,low,left),p(x,low,right),p(x,high,right),p(x,high,left)],reverse);
    }
  };
  band(outer,inner,bottom,deckTop);
  band(outer,parapetInner,deckTop,w.height,subtractRanges(0,1,wallAccessRanges(w,'outer')));
  return finish();
}
