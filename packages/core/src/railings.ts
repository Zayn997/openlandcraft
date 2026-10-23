import type {Slab,Wall} from './model';
import {wallWalkProfile} from './wall-walks';
import {pathLength,wallPathPoint} from './wall-path';
import {wallAccessRanges,subtractRanges} from './stair-connections';
import {spiralPoint,spiralSweep} from './spiral-stairs';

export const RAILING_SECTION=.04;
export const DEFAULT_RAILING={height:1.1,spacing:1.5};
export type RailingPoint=[number,number,number];
export type RailingRun={posts:{base:RailingPoint;top:RailingPoint}[];top:RailingPoint[];closed:boolean;side?:'left'|'right'};
export type RailingHost=Wall|Slab;
export function wallRailingLength(wall:Wall):number{
  if(!wall.walk)return 0;
  const inset=wallWalkProfile(wall).inner-RAILING_SECTION/2;
  return wall.curve?(wall.curve.radius-inset)*Math.abs(wall.curve.sweepAngle)*Math.PI/180:pathLength(wall);
}
/** Points are derived in level space; the owning wall/flight stays the only editable object. */
export function railingRuns(host:RailingHost):RailingRun[]{
  if(host.kind==='wall'){
    const railing=host.walk?.railings;if(!railing)return [];
    const profile=wallWalkProfile(host),length=wallRailingLength(host),circle=!!host.curve&&Math.abs(host.curve.sweepAngle)===360;
    const cuts=wallAccessRanges(host,'inner',true);let intervals=subtractRanges(0,1,cuts);
    if(circle&&cuts.length&&intervals.length>1&&intervals[0][0]===0&&intervals.at(-1)![1]===1){const first=intervals.shift()!,last=intervals.pop()!;intervals.push([last[0],first[1]+1]);}
    return intervals.filter(([a,b])=>b-a>1e-8).map(([a,b])=>{
      const closed=circle&&!cuts.length,span=(b-a)*length;
      const count=Math.max(closed?3:1,Math.ceil(span/railing.spacing));
      const point=(t:number,y:number):RailingPoint=>{const p=wallPathPoint(host,t,profile.side*(profile.inner-RAILING_SECTION/2));return [p[0],host.elevation+y,p[1]];};
      const posts=Array.from({length:count+(closed?0:1)},(_,i)=>{const t=a+(b-a)*i/count;return {base:point(t,profile.deckTop),top:point(t,profile.deckTop+railing.height)};});
      // Rail bends are sampled independently of post spacing, including both arc ends.
      const segments=host.curve?Math.max(1,Math.ceil(Math.abs(host.curve.sweepAngle)*(b-a)/3)):1;
      const top=Array.from({length:segments+1},(_,i)=>point(a+(b-a)*i/segments,profile.deckTop+railing.height));
      return {posts,top,closed};
    });
  }
  const stairs=host.stairs,railing=stairs?.railings;if(!stairs||!railing)return [];
  if(stairs.spiral){
    const spiral=stairs.spiral,sweep=spiralSweep(host),sign=Math.sign(sweep);
    return withLandingRails(host,(railing.side==='both'?[-1,1]:[railing.side==='left'?1:-1]).map(side=>{
      const radius=spiral.radius-host.width/2-side*sign*(host.width-RAILING_SECTION)/2,length=radius*Math.abs(sweep),start=RAILING_SECTION/2/length,end=1-start;
      const topY=(t:number)=>host.elevation+stairs.rise/stairs.steps+Math.min(t,1-1/stairs.steps)*stairs.rise+railing.height;
      const point=(t:number,y:number):RailingPoint=>{const p=spiralPoint(host,t,radius);return [p[0],y,p[1]];};
      const count=Math.max(1,Math.ceil((end-start)*length/railing.spacing)),posts=Array.from({length:count+1},(_,i)=>{const t=start+(end-start)*i/count;return {base:point(t,host.elevation+(Math.floor(t*stairs.steps)+1)*stairs.rise/stairs.steps),top:point(t,topY(t))};});
      const samples=Math.ceil(Math.abs(sweep)*180/Math.PI/3),knots=Array.from({length:samples+1},(_,i)=>start+(end-start)*i/samples),last=1-1/stairs.steps;if(last>start&&last<end)knots.push(last);knots.sort((a,b)=>a-b);
      return {posts,top:knots.map(t=>point(t,topY(t))),closed:false,side:side>0?'left':'right'};
    }));
  }
  const angle=stairs.direction*Math.PI/180,up=[Math.cos(angle),Math.sin(angle)],across=[-up[1],up[0]],tread=host.depth/stairs.steps;
  const start=RAILING_SECTION/2,end=host.depth-RAILING_SECTION/2,lastNosing=host.depth-tread;
  const railY=(x:number)=>stairs.rise/stairs.steps+Math.min(x,lastNosing)*stairs.rise/host.depth;
  const railAnchors=[start,...(lastNosing>start&&lastNosing<end?[lastNosing]:[]),end];
  const count=Math.max(1,Math.ceil((end-start)/railing.spacing));
  const postAnchors=Array.from({length:count+1},(_,i)=>start+(end-start)*i/count);
  return withLandingRails(host,(railing.side==='both'?[-1,1]:[railing.side==='left'?1:-1]).map(side=>{
    const point=(x:number,y:number):RailingPoint=>{const along=x-host.depth/2,lateral=side*(host.width-RAILING_SECTION)/2;return [host.center[0]+up[0]*along+across[0]*lateral,host.elevation+y,host.center[1]+up[1]*along+across[1]*lateral];};
    return {posts:postAnchors.map(x=>({base:point(x,(Math.floor(x/tread)+1)*stairs.rise/stairs.steps),top:point(x,railY(x)+railing.height)})),top:railAnchors.map(x=>point(x,railY(x)+railing.height)),closed:false,side:side>0?'left':'right'};
  }));
}
function withLandingRails(host:Slab,runs:RailingRun[]):RailingRun[]{
  const railing=host.stairs!.railings!;
  for(const [end,pad] of Object.entries(host.stairs!.landings??{}))for(const path of pad.railPaths){
    if(railing.side!=='both'&&railing.side!==path.side)continue;
    const top:RailingPoint[]=path.points.map(p=>[p[0],pad.elevation+railing.height,p[1]]);
    const posts:RailingRun['posts']=[];
    const distances=[0];for(let i=1;i<path.points.length;i++)distances.push(distances[i-1]+Math.hypot(path.points[i][0]-path.points[i-1][0],path.points[i][1]-path.points[i-1][1]));
    const length=distances.at(-1)!,count=Math.max(1,Math.ceil(length/railing.spacing)),stations=Array.from({length:count+1},(_,i)=>length*i/count);
    // Arc samples bend the rails, not the post pattern. Keep extra posts only at
    // real landing corners, such as the end guard changing from arc to radial.
    for(let i=1;i<path.points.length-1;i++){const a=path.points[i-1],b=path.points[i],c=path.points[i+1],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];if((u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v))<Math.cos(Math.PI/12))stations.push(distances[i]);}
    const unique=stations.sort((a,b)=>a-b).filter((v,i,a)=>i===0||v-a[i-1]>1e-7);
    for(const at of unique){const i=Math.max(1,distances.findIndex((d,i)=>i>0&&d>=at-1e-8)),a=path.points[i-1],b=path.points[i],t=(at-distances[i-1])/(distances[i]-distances[i-1]||1),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;posts.push({base:[x,pad.elevation,z],top:[x,pad.elevation+railing.height,z]});}
    const flight=runs.find(r=>r.side===path.side);if(flight)top.unshift(end==='bottom'?flight.top[0]:flight.top.at(-1)!);
    runs.push({posts,top,closed:false,side:path.side});
  }
  return runs;
}
export function railingIssue(host:RailingHost):string|null{
  const railing=host.kind==='wall'?host.walk?.railings:host.stairs?.railings;if(!railing)return null;
  if(!Number.isFinite(railing.height)||railing.height<.3||railing.height>2.5||!Number.isFinite(railing.spacing)||railing.spacing<.2||railing.spacing>5)return 'Use railing height 0.3–2.5 m and maximum post spacing 0.2–5 m.';
  if(host.kind==='wall'){
    const length=wallRailingLength(host),gap=host.walk!.railings!.gap;
    if(gap){
      if(!Number.isFinite(gap.position)||gap.position<0||gap.position>1||!Number.isFinite(gap.width)||gap.width<.5||gap.width>8||gap.width+RAILING_SECTION>length-.1)return 'Keep the access opening 0.5–8 m wide and leave at least 0.1 m of railing.';
      if((!host.curve||Math.abs(host.curve.sweepAngle)!==360)&&(gap.position*length<(gap.width+RAILING_SECTION)/2-1e-8||(1-gap.position)*length<(gap.width+RAILING_SECTION)/2-1e-8))return 'Move the access opening center away from the wall ends, or reduce its width.';
    }
    if(Math.ceil(length/railing.spacing)+4>512)return 'Increase post spacing or reduce wall length to keep at most 512 railing posts.';
  }else{
    if(!['left','right','both'].includes(host.stairs!.railings!.side))return 'Choose the left, right or both sides of the stairs.';
    if(host.stairs!.spiral&&Math.ceil(host.stairs!.spiral.radius*Math.abs(spiralSweep(host))/railing.spacing)+1>512)return 'Increase post spacing to keep at most 512 posts on each spiral edge.';
  }
  return null;
}
