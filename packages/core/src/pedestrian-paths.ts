import { lakeDistance, pathStrips, roundedRoutePoints, type PathPoint } from '@openlandcraft/landscape';
import type { Path } from './model';

type Clearance = (x: number, z: number, radius: number) => boolean;
export type WalkNode = { x: number; z: number; station: number; offset: number; neighbors: number[]; component: number };
export type WalkGraph = { id: string; name: string; width: number; bodyRadius: number; nodes: WalkNode[]; components: number[][]; clear: Clearance; segmentClear:(a:WalkNode,b:WalkNode)=>boolean };
export type PedestrianPath = { graph: WalkGraph; start: number };

/** A narrow navigation mesh inside the actual mitered path surface. */
export function pedestrianGraph(path: Path, radius: number, habitatClear: Clearance): WalkGraph {
  path={...path,points:roundedRoutePoints(path),cornerRounding:undefined};
  const strips = pathStrips(path), right = [strips[0][0],...strips.map(s => s[1])], left = [strips[0][3],...strips.map(s => s[2])];
  const outline = [...right,...left.slice().reverse()];
  // Certify a whole shortcut with covering disks; subdivide only if a broad
  // disk touches an obstacle. Avoid resampling every tree/water boundary at
  // every 10 cm for each candidate shortcut on every patrol turnaround.
  const cover=(ax:number,az:number,bx:number,bz:number):boolean=>{
    const x=(ax+bx)/2,z=(az+bz)/2,length=Math.hypot(bx-ax,bz-az);
    if(habitatClear(x,z,radius+.025+length/2))return true;
    return length>.1&&cover(ax,az,x,z)&&cover(x,z,bx,bz);
  };
  const graph: WalkGraph = {id:path.id,name:path.name,width:path.width,bodyRadius:radius,nodes:[],components:[],clear:(x,z,r) =>
    lakeDistance(outline,x,z) >= r+0.04 && habitatClear(x,z,r),segmentClear:(a,b)=>{
      const length=Math.hypot(b.x-a.x,b.z-a.z);
      if(!length)return graph.clear(a.x,a.z,radius+.025);
      for(let k=0;k<=Math.ceil(length/.1);k++){
        const t=Math.min(1,k*.1/length);
        if(lakeDistance(outline,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)<radius+.065)return false;
      }
      return cover(a.x,a.z,b.x,b.z);
    }};
  const available = path.width/2-radius-0.1;
  if (available < 0) return graph;
  const lanes = Math.max(1,2*Math.ceil(available/0.32)+1), rows: number[][] = [];
  let station = 0;
  for (let segment = 1; segment < path.points.length; segment++) {
    const a = path.points[segment-1], b = path.points[segment], length = Math.hypot(b[0]-a[0],b[1]-a[1]), steps = Math.ceil(length/0.42);
    const ra = right[segment-1], rb = right[segment], la = left[segment-1], lb = left[segment];
    for (let step = segment === 1 ? 0 : 1; step <= steps; step++) {
      const t = step/steps, center: PathPoint = [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      const normal = [(la[0]+(lb[0]-la[0])*t-ra[0]-(rb[0]-ra[0])*t)/path.width,(la[1]+(lb[1]-la[1])*t-ra[1]-(rb[1]-ra[1])*t)/path.width];
      const row: number[] = [];
      for (let lane = 0; lane < lanes; lane++) {
        const offset = lanes === 1 ? 0 : (lane/(lanes-1)*2-1)*available;
        const x = center[0]+normal[0]*offset, z = center[1]+normal[1]*offset;
        if (!graph.clear(x,z,radius+0.025)) { row.push(-1); continue; }
        row.push(graph.nodes.length); graph.nodes.push({x,z,station:station+length*t,offset,neighbors:[],component:-1});
      }
      const connect = (i: number, j: number) => {
        if (i < 0 || j < 0) return;
        const p = graph.nodes[i], q = graph.nodes[j], distance = Math.hypot(p.x-q.x,p.z-q.z);
        // A covering disk checks the complete edge against buildings and terrain.
        if (!habitatClear((p.x+q.x)/2,(p.z+q.z)/2,radius+distance/2+0.025)) return;
        const count = Math.max(1,Math.ceil(distance/0.1));
        for (let k = 1; k < count; k++) if (lakeDistance(outline,p.x+(q.x-p.x)*k/count,p.z+(q.z-p.z)*k/count) < radius+0.04) return;
        p.neighbors.push(j); q.neighbors.push(i);
      };
      row.forEach((index,lane) => {
        if (lane) connect(index,row[lane-1]);
        const previous = rows.at(-1);
        if (previous) for (let adjacent = Math.max(0,lane-1); adjacent <= Math.min(lanes-1,lane+1); adjacent++) connect(index,previous[adjacent]);
      });
      rows.push(row);
    }
    station += length;
  }
  for (let i = 0; i < graph.nodes.length; i++) {
    if (graph.nodes[i].component >= 0) continue;
    const component = graph.components.length, members = [i]; graph.nodes[i].component = component;
    for (let cursor = 0; cursor < members.length; cursor++) for (const neighbor of graph.nodes[members[cursor]].neighbors)
      if (graph.nodes[neighbor].component < 0) { graph.nodes[neighbor].component = component; members.push(neighbor); }
    graph.components.push(members);
  }
  return graph;
}

export function nearestWalkNode(graph: WalkGraph, x: number, z: number, allowed?: (index: number) => boolean): number {
  let closest = -1, distance = Infinity;
  graph.nodes.forEach((node,index) => {
    if (allowed && !allowed(index)) return;
    const next = Math.hypot(node.x-x,node.z-z);
    if (next < distance) { closest = index; distance = next; }
  });
  return closest;
}

/** Binary heap keeps patrol replanning bounded even on long, wide paths. */
class Queue {
  values: {index:number;score:number}[] = [];
  push(value:{index:number;score:number}) {
    const a = this.values; a.push(value); let i = a.length-1;
    while (i) { const parent = (i-1)>>1; if (a[parent].score <= value.score) break; a[i] = a[parent]; i = parent; } a[i] = value;
  }
  pop() {
    const a = this.values, top = a[0], last = a.pop()!;
    if (a.length) { let i = 0; while (i*2+1 < a.length) { let child = i*2+1; if (child+1 < a.length && a[child+1].score < a[child].score) child++; if (a[child].score >= last.score) break; a[i] = a[child]; i = child; } a[i] = last; }
    return top;
  }
}

/** Prefer the right side in each direction, but use the full safe corridor for detours. */
export function walkPatrol(graph: WalkGraph, start: number, direction: number, blocked?: (index:number)=>boolean, clearance?: (x:number,z:number)=>boolean): number[] {
  const node = graph.nodes[start]; if (!node) return [];
  const members = graph.components[node.component];
  const end = direction > 0 ? Math.max(...members.map(i => graph.nodes[i].station)) : Math.min(...members.map(i => graph.nodes[i].station));
  if (Math.abs(end-node.station) < 0.7) return [];
  const desired = direction*Math.max(0,graph.width/2-graph.bodyRadius-0.13);
  const targets = members.filter(i => Math.abs(graph.nodes[i].station-end) < 0.01 && (!blocked || !blocked(i)));
  if (!targets.length) return [];
  const costs = new Float64Array(graph.nodes.length).fill(Infinity), previous = new Int32Array(graph.nodes.length).fill(-1), queue = new Queue();
  costs[start] = 0; queue.push({index:start,score:0});
  const targetSet = new Set(targets);
  let goal = -1;
  while (queue.values.length) {
    const current = queue.pop(); if (current.score > costs[current.index]+1e-8) continue;
    if (targetSet.has(current.index)) { goal = current.index; break; }
    const p = graph.nodes[current.index];
    for (const index of p.neighbors) {
      if (blocked?.(index) && index !== start) continue;
      const q = graph.nodes[index], length = Math.hypot(q.x-p.x,q.z-p.z);
      const cost = current.score+length*(1+Math.abs(q.offset-desired)*1.3)+Math.max(0,(p.station-q.station)*direction)*2;
      if (cost >= costs[index]) continue;
      costs[index] = cost; previous[index] = current.index; queue.push({index,score:cost});
    }
  }
  if (goal < 0) return [];
  const route = [goal]; while (route.at(-1) !== start) route.push(previous[route.at(-1)!]); route.reverse();
  // Remove stair steps, keeping every smoothed segment inside the safe path corridor.
  const smooth = [start];
  for (let i = 0; i < route.length-1;) {
    let next = i+1;
    for (let j = i+2; j < Math.min(route.length,i+16); j++) {
      const a = graph.nodes[route[i]], b = graph.nodes[route[j]], length = Math.hypot(b.x-a.x,b.z-a.z);
      let clear = graph.segmentClear(a,b);
      for (let k = 0; clear&&clearance&&k <= Math.ceil(length/0.1); k++) {
        const t = Math.min(1,k*0.1/length);
        const x = a.x+(b.x-a.x)*t, z = a.z+(b.z-a.z)*t;
        if (!clearance(x,z)) { clear = false; break; }
      }
      if (!clear) break; next = j;
    }
    smooth.push(route[next]); i = next;
  }
  return smooth;
}
