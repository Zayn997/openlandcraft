import {bridgeHeight,bridgeContains,bridgeStation,pathStrips,clipPathPolygon,polygonArea,compileSurface,regionTriangles,lakeWaterDistance,terrainTriangleHeight,sampleRiver,pointSegmentDistance,type PathPoint} from '@openlandcraft/landscape';
import {parseProject,type Path,type Project} from './model';
import {gradedTerrain} from './site-grading';
import {objectLayerState} from './layers';

/** Independent bank endpoints: shoreline edits validate without moving the bridge. */
export function bridgeIssue(path:Path,project:Project):string|null{
  if(!path.bridge)return null;
  const b=path.bridge,{length,tx,tz}=bridgeStation(path,path.points[0]),r=b.approachLength;
  if(length>80||length<2*r+2*b.abutmentLength+1)return 'Keep a bridge within 80 m, with room for both approaches, abutments and the span.';
  let field;try{field=gradedTerrain(project);}catch(error){return error instanceof Error?error.message:'Invalid bridge bank grading.';}
  const site={...project.site,terrain:field};
  const strip=pathStrips(path)[0];
  for(const other of project.entities){
    if(other.id===path.id)continue;
    if(other.kind==='path'&&other.bridge&&polygonArea(clipPathPolygon(strip,pathStrips(other)[0]))>.01)return 'Separate bridge spans and their bank approaches.';
    if(other.kind==='path'||other.kind==='materialRegion'&&other.surface==='paving'){const surface=compileSurface(other);for(const polygon of other.kind==='path'?surface.polygons:regionTriangles(other.points)){const overlap=clipPathPolygon(strip,polygon);if(polygonArea(overlap)>.01&&overlap.some(q=>Math.abs(bridgeHeight(path,site,q)-(other.elevationMode==='fixed'?surface.height(q):terrainTriangleHeight(site,q)))<.015))return 'End paths and courtyards at the bridge bank endpoints. Keep other surfaces clear of its deck and approaches.';}}
  }
  const waters=project.entities.filter(e=>e.kind==='lake');
  const rivers=project.entities.filter(e=>e.kind==='river').map(river=>({river,points:sampleRiver(river.points)})),sea=project.entities.find(e=>e.kind==='ocean');
  const sample=(s:number,c:number):PathPoint=>[path.points[0][0]+s*tx-c*tz,path.points[0][1]+s*tz+c*tx];
  for(const end of [0,length]){
    const ground=terrainTriangleHeight(site,sample(end,0));
    if(Math.abs(path.elevation!-ground)/r>.45)return 'Keep bridge approaches at or below 45% slope. Adjust the deck height, approach length or bank endpoints.';
  }
  for(let s=0;s<=length+.001;s=Math.min(length,s+.25)){
    for(const c of [-path.width/2,0,path.width/2]){
      const p=sample(s,c),y=bridgeHeight(path,site,p),ground=terrainTriangleHeight(site,p);
      if(y<ground-.04)return 'The bridge deck intersects terrain. Raise the deck or move its bank endpoints.';
      if(sea?.kind==='ocean'&&ground<=sea.level+2*sea.amplitude+.15||rivers.some(({river,points})=>points.some((v,i)=>i>0&&pointSegmentDistance(p,[points[i-1].x,points[i-1].z],[v.x,v.z])<river.width/2+river.bank)))return 'This bridge supports lakes and moats. Keep its footprint clear of river and ocean water.';
      for(const lake of waters){
        const distance=lakeWaterDistance(lake,...p),onBank=s<=r+b.abutmentLength/2||s>=length-r-b.abutmentLength/2;
        if(onBank&&distance> -lake.bank-.1)return 'Keep both approaches and abutments on dry banks, beyond the bank blend. Move the bridge endpoints.';
        if(distance>=0&&path.elevation!-b.thickness<lake.level+2*lake.amplitude+.15)return 'Raise the bridge deck so its underside clears the water and waves by 0.15 m.';
      }
    }
    if(s===length)break;
  }
  return null;
}
export function createBridge(project:Project,lakeId?:string):Path{
  const lake=project.entities.find(e=>e.kind==='lake'&&(!lakeId||e.id===lakeId));
  if(lake?.kind!=='lake')throw new Error('Add a lake or ring moat before adding a bank-to-bank bridge.');
  const bridge={thickness:.3,approachLength:2,abutmentLength:1,railingHeight:1},setback=lake.bank+bridge.approachLength+bridge.abutmentLength/2+.75;
  const loop=lake.holes?.[0]??lake.points,center:PathPoint=[loop.reduce((n,p)=>n+p[0],0)/loop.length,loop.reduce((n,p)=>n+p[1],0)/loop.length];
  for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length],shore:PathPoint=[(a[0]+b[0])/2,(a[1]+b[1])/2],dx=shore[0]-center[0],dz=shore[1]-center[1],n=Math.hypot(dx,dz),tx=dx/n,tz=dz/n;
    const start:PathPoint=lake.holes?[shore[0]-tx*setback,shore[1]-tz*setback]:[shore[0]+tx*setback,shore[1]+tz*setback],sign=lake.holes?1:-1;
    let crossed=false;
    for(let t=.25;t<=80;t+=.25){
      const p:PathPoint=[shore[0]+sign*tx*t,shore[1]+sign*tz*t],d=lakeWaterDistance(lake,...p);if(d>0)crossed=true;
      if(!crossed||d> -setback)continue;
      const site=project.site,elevation=Math.max(lake.level+2*lake.amplitude+bridge.thickness+.2,terrainTriangleHeight(site,start),terrainTriangleHeight(site,p));
      const path:Path={id:crypto.randomUUID(),parentId:'site',kind:'path',name:'Moat bridge',visible:true,points:[start,p],width:3,surface:'timber',elevationMode:'fixed',elevation,bridge};
      try{parseProject({...project,entities:[...project.entities,path]});return path;}catch{break;}
    }
  }
  throw new Error('No clear bank-to-bank bridge position fits here. Leave dry bank space for the approaches and abutments, then try again.');
}
export function walkingHeight(project:Project,x:number,z:number):number{
  const bridge=project.entities.find((e):e is Path=>e.kind==='path'&&!!e.bridge&&e.visible&&objectLayerState(project,e.id).visible&&bridgeContains(e,[x,z]));
  return bridge?bridgeHeight(bridge,project.site,[x,z]):terrainTriangleHeight(project.site,[x,z]);
}
