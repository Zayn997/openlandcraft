import type { PathPoint } from '@openlandcraft/landscape';
import { groundHeight, parseProject, type Lake, type Project } from './model';
import { WATER_APPEARANCE_DEFAULTS } from './materials';

export function createLake(project:Project,points?:PathPoint[]):Lake {
  const {width,depth,terrain}=project.site,radius=Math.min(10,Math.min(width,depth)*0.13),bank=Math.max(1,Math.ceil(10*Math.max(width/(terrain.columns-1),depth/(terrain.rows-1)))/10);
  const build=(boundary:PathPoint[]):Lake=>({id:crypto.randomUUID(),kind:'lake',parentId:'site',visible:true,name:'Landscape lake',points:boundary,
    level:Math.max(-8+1.5,Math.min(30,Math.min(...boundary.map(p=>groundHeight(...p,project.site)))-0.1)),depth:1.5,bank,
    amplitude:0.08,wavelength:3.5,direction:35,speed:0.7,foam:0.35,foamPersistence:4,wetBank:0.7,dryingTime:20,color:'#408c82',appearance:{...WATER_APPEARANCE_DEFAULTS}});
  if(points)return build(points);
  for(const [fx,fz] of [[-.3,.28],[-.3,-.28],[-.1,.28],[-.3,0],[.25,.25],[.25,-.25],[0,0]]){
    const lake=build(Array.from({length:8},(_,i):PathPoint=>[width*fx+Math.cos(i*Math.PI/4)*radius,depth*fz+Math.sin(i*Math.PI/4)*radius]));
    try{parseProject({...project,entities:[...project.entities,lake]});return lake;}catch{/* Try another bounded starter location. */}
  }
  throw new Error('No space for a starter lake here. Draw a lake on inland ground, away from the river and site edges.');
}
