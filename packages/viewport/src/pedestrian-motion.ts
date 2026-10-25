import { walkingHeight, nearestWalkNode, walkPatrol, type GroundRoute, type Project } from '@openlandcraft/core';
import { groundCharacterPose } from './ground-character-motion';
import { PATH_LIFT } from './path-geometry';
import {startWork,endWork} from './frame-profile';

export type CharacterPose = { x:number; y:number; z:number; yaw:number; pitch:number; walkTime:number; idleTime:number; walkWeight:number };
type Agent = { route:GroundRoute; pose:CharacterPose; previous:CharacterPose; direction:number; waypoints:number[]; waypoint:number; speed:number; waiting:number; visible:boolean };
type TurnGate = {x:number;z:number;depth:number;owner?:Agent};
const STEP = 1/30, GAP = 0.12;
const angleDifference = (a:number,b:number) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
const distance = (a:{x:number;z:number},b:{x:number;z:number}) => Math.hypot(a.x-b.x,a.z-b.z);
const walkStation = (agent:Agent,point:{x:number;z:number} = agent.pose) => {
  const graph = agent.route.path!.graph, b = graph.nodes[agent.waypoints[agent.waypoint]], a = graph.nodes[agent.waypoints[Math.max(0,agent.waypoint-1)]];
  if (!a || !b) return graph.nodes[agent.route.path!.start].station;
  const dx = b.x-a.x, dz = b.z-a.z, length = dx*dx+dz*dz;
  const t = length ? Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/length)) : 0;
  return a.station+(b.station-a.station)*t;
};

/** Minimum distance during the whole simultaneous step, including crossing trajectories. */
export function walkingClearance(a:{x:number;z:number},end:{x:number;z:number},b:{x:number;z:number},bEnd:{x:number;z:number}) {
  const x = a.x-b.x, z = a.z-b.z, vx = end.x-a.x-bEnd.x+b.x, vz = end.z-a.z-bEnd.z+b.z;
  const denominator = vx*vx+vz*vz, t = denominator ? Math.max(0,Math.min(1,-(x*vx+z*vz)/denominator)) : 0;
  return Math.hypot(x+vx*t,z+vz*t);
}

/** One shared, fixed-step crowd across every person asset. Geometry is planned on scene edits. */
export class PedestrianSimulation {
  readonly agents = new Map<string,Agent>();
  private time = 0;
  private accumulator = 0;
  private gates:TurnGate[] = [];
  private turnAreas = new Map<Agent,{min:number;max:number;start:TurnGate;end:TurnGate}>();
  constructor(readonly project:Project, routes:ReadonlyMap<string,GroundRoute>) {
    // Standing figures and horses get their reserved locations before pedestrian allocation.
    const ordered = [...routes.values()].sort((a,b) => Number(!!a.path)-Number(!!b.path) || a.entity.id.localeCompare(b.entity.id));
    for (const route of ordered) {
      const base = groundCharacterPose(0,route,project);
      const pose:CharacterPose = {...base,walkTime:base.clipTime,idleTime:base.clipTime,walkWeight:route.radius ? 1 : 0};
      const agent:Agent = {route,pose,previous:{...pose},direction:route.seed < 0.5 ? 1 : -1,waypoints:[],waypoint:1,speed:0,waiting:0,visible:true};
      if (route.path) {
        const {graph,start} = route.path;
        const component = graph.nodes[start].component;
        const index = nearestWalkNode(graph,route.x,route.z,i => {
          const node = graph.nodes[i];
          if (node.component !== component) return false;
          if ([...this.agents.values()].some(other => other.visible && distance(node,other.pose) < route.bodyRadius+other.route.bodyRadius+GAP)) return false;
          // Keep unallocated authored positions clear so an overfull path can safely fall back to idle.
          return ordered.every(other => other === route || this.agents.has(other.entity.id) || distance(node,other) >= route.bodyRadius+other.bodyRadius+GAP);
        });
        if (index >= 0) {
          pose.x = graph.nodes[index].x; pose.z = graph.nodes[index].z;
          pose.y = walkingHeight(project,pose.x,pose.z)+route.entity.position[1]+PATH_LIFT;
          agent.waypoints = walkPatrol(graph,index,agent.direction);
          if (agent.waypoints.length < 2) { agent.direction *= -1; agent.waypoints = walkPatrol(graph,index,agent.direction); }
          const next = graph.nodes[agent.waypoints[1]];
          if (next) pose.yaw = Math.atan2(next.x-pose.x,next.z-pose.z);
        } else {
          agent.route = {...route,path:undefined,reason:'blocked'};
        }
      }
      agent.previous = {...pose}; this.agents.set(route.entity.id,agent);
    }
    for (const agent of this.agents.values()) {
      const graph = agent.route.path?.graph; if (!graph || graph.width < 4*agent.route.bodyRadius+0.4) continue;
      const start = graph.nodes[agent.route.path!.start], members = graph.components[start.component];
      const stations = members.map(i => graph.nodes[i].station), min = Math.min(...stations), max = Math.max(...stations);
      const gate = (station:number) => {
        const row = members.map(i => graph.nodes[i]).filter(n => Math.abs(n.station-station) < 0.01);
        const center = {x:row.reduce((v,n) => v+n.x,0)/row.length,z:row.reduce((v,n) => v+n.z,0)/row.length};
        let area = this.gates.find(g => distance(g,center) < Math.max(1.5,agent.route.bodyRadius*2));
        if (!area) { area = {...center,depth:Math.max(2.2,agent.route.bodyRadius*4)}; this.gates.push(area); }
        area.depth = Math.max(area.depth,agent.route.bodyRadius*4); return area;
      };
      this.turnAreas.set(agent,{min,max,start:gate(min),end:gate(max)});
    }
    // A turn bay admits one person at a time, preventing a queue from filling the U-turn.
    for (const [agent,areas] of this.turnAreas) {
      const station = walkStation(agent);
      if (station-areas.min < areas.start.depth && !areas.start.owner) areas.start.owner = agent;
      if (areas.max-station < areas.end.depth && !areas.end.owner) areas.end.owner = agent;
    }
  }

  advance(delta:number,playing = true,reducedMotion = false) {
    if (!playing || reducedMotion || !Number.isFinite(delta) || delta <= 0) return;
    this.accumulator += Math.min(delta,0.1);
    while (this.accumulator+1e-9 >= STEP) { this.step(STEP); this.accumulator -= STEP; }
  }

  sample(id:string):CharacterPose | undefined {
    const agent = this.agents.get(id); if (!agent?.visible) return undefined;
    const a = agent.previous, b = agent.pose, t = Math.max(0,Math.min(1,this.accumulator/STEP));
    const x = a.x+(b.x-a.x)*t, z = a.z+(b.z-a.z)*t;
    return {x,z,y:agent.route.path ? walkingHeight(this.project,x,z)+agent.route.entity.position[1]+PATH_LIFT : a.y+(b.y-a.y)*t,
      yaw:a.yaw+angleDifference(b.yaw,a.yaw)*t,pitch:a.pitch+(b.pitch-a.pitch)*t,
      walkTime:a.walkTime+(b.walkTime-a.walkTime)*t,idleTime:a.idleTime+(b.idleTime-a.idleTime)*t,walkWeight:a.walkWeight+(b.walkWeight-a.walkWeight)*t};
  }

  private replan(agent:Agent,avoidPeople:boolean) {
    const graph = agent.route.path!.graph, start = nearestWalkNode(graph,agent.pose.x,agent.pose.z);
    if (start < 0) return false;
    const clear = (x:number,z:number) => [...this.agents.values()].every(other => other === agent || !other.visible || Math.hypot(x-other.pose.x,z-other.pose.z) >= agent.route.bodyRadius+other.route.bodyRadius+GAP+0.08);
    const started=startWork();
    const route = walkPatrol(graph,start,agent.direction,avoidPeople ? i => !clear(graph.nodes[i].x,graph.nodes[i].z) : undefined,avoidPeople ? clear : undefined);
    endWork('character-route-planning',started);
    if (route.length < 2) return false;
    // Include the graph start when off-center after a collision stop; no teleport to a node.
    agent.waypoints = route; agent.waypoint = distance(agent.pose,graph.nodes[start]) > 0.12 ? 0 : 1; return true;
  }

  private step(dt:number) {
    this.time += dt;
    const agents = [...this.agents.values()];
    for (const agent of agents) agent.previous = {...agent.pose};
    for (const [agent,areas] of this.turnAreas) {
      const station = walkStation(agent);
      if (areas.start.owner === agent && station-areas.min > areas.start.depth+0.6) areas.start.owner = undefined;
      if (areas.end.owner === agent && areas.max-station > areas.end.depth+0.6) areas.end.owner = undefined;
    }
    for (const agent of agents) if (!agent.route.path) {
      const base = groundCharacterPose(this.time,agent.route,this.project);
      agent.pose = {...base,walkTime:base.clipTime,idleTime:base.clipTime,walkWeight:agent.route.radius ? 1 : 0};
    }
    for (const agent of agents) {
      if (!agent.route.path || !agent.visible) continue;
      const {graph} = agent.route.path, pose = agent.pose;
      let target = graph.nodes[agent.waypoints[agent.waypoint]];
      if (!target || distance(pose,target) < 0.065) {
        agent.waypoint++;
        target = graph.nodes[agent.waypoints[agent.waypoint]];
        if (!target) { agent.direction *= -1; this.replan(agent,false); target = graph.nodes[agent.waypoints[agent.waypoint]]; }
      }
      let moved = 0;
      if (target) {
        const dx = target.x-pose.x, dz = target.z-pose.z, remaining = Math.hypot(dx,dz), heading = Math.atan2(dx,dz);
        const turn = angleDifference(heading,pose.yaw); pose.yaw += Math.max(-2.5*dt,Math.min(2.5*dt,turn));
        const desired = Math.abs(turn) > 0.5 ? 0 : agent.route.speed*(0.94+agent.route.seed*0.12);
        agent.speed += Math.max(-1.8*dt,Math.min(0.8*dt,desired-agent.speed));
        const travel = Math.min(remaining,agent.speed*dt), end = {x:pose.x+(remaining ? dx/remaining*travel : 0),z:pose.z+(remaining ? dz/remaining*travel : 0)};
        let waitingForTurn = false;
        const areas = this.turnAreas.get(agent);
        if (areas) {
          const station = walkStation(agent,end);
          for (const [gate,inside,leaving] of [[areas.start,station-areas.min < areas.start.depth,agent.direction > 0],[areas.end,areas.max-station < areas.end.depth,agent.direction < 0]] as const) {
            if (!inside) continue;
            if (gate.owner && gate.owner !== agent) {
              // Already outgoing pedestrians can clear a bay occupied by an incoming one.
              const current = walkStation(agent);
              const wasInside = gate === areas.start ? current-areas.min < gate.depth-0.3 : areas.max-current < gate.depth-0.3;
              if (!leaving || !wasInside) waitingForTurn = true;
            } else if (!gate.owner) gate.owner = agent;
          }
        }
        let blocker:Agent | undefined;
        for (const other of agents) {
          if (other === agent || !other.visible) continue;
          if (walkingClearance(agent.previous,end,other.previous,other.pose) < agent.route.bodyRadius+other.route.bodyRadius+GAP) { blocker = other; break; }
        }
        if (!waitingForTurn && !blocker && graph.clear(end.x,end.z,agent.route.bodyRadius+0.015)) {
          pose.x = end.x; pose.z = end.z; moved = travel; agent.waiting = 0;
        } else {
          agent.speed = 0; agent.waiting += dt;
          if (agent.waiting > 1.35 && !waitingForTurn) {
            const detour = this.replan(agent,true);
            const headOn = blocker?.route.path && Math.cos(pose.yaw-blocker.pose.yaw) < -0.2;
            const backRoom = (person:Agent) => {
              const mesh = person.route.path!.graph, node = mesh.nodes[nearestWalkNode(mesh,person.pose.x,person.pose.z)];
              const stations = mesh.components[node.component].map(i => mesh.nodes[i].station);
              return person.direction > 0 ? node.station-Math.min(...stations) : Math.max(...stations)-node.station;
            };
            const yieldHere = headOn && (agent.route.entity.id.localeCompare(blocker!.route.entity.id) > 0 || backRoom(blocker!) < 2.5*blocker!.route.bodyRadius);
            if (!detour && yieldHere) {
              agent.direction *= -1;
              if (!this.replan(agent,true)) agent.direction *= -1;
            }
            agent.waiting = 0;
          }
        }
      }
      const scale = Math.max(...agent.route.entity.scale);
      pose.walkTime += moved/(0.85*scale);
      pose.idleTime = this.time+agent.route.seed*3;
      const weight = moved > 1e-5 ? Math.min(1,agent.speed/(agent.route.speed*0.65)) : 0;
      pose.walkWeight += (weight-pose.walkWeight)*(1-Math.exp(-dt*10));
      pose.y = walkingHeight(this.project,pose.x,pose.z)+agent.route.entity.position[1]+PATH_LIFT;
    }
  }
}
