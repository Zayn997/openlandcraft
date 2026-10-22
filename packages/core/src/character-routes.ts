import { walkingRouteIssue, roundedRoutePoints, type PathPoint } from '@openlandcraft/landscape';
import { assetAnimation } from './asset-animation';
import { walkingRouteSchema, type Instance, type Path, type Project } from './model';
export const ROUND_ROUTE_GESTURE='Round walking route corner';

/** A navigation corridor owned by one person; it never creates a landscape surface. */
export function characterWalkingPath(entity:Instance):Path | undefined {
  const route=entity.walkingRoute;
  return route ? {id:`character-route:${entity.id}`,parentId:'site',kind:'path',name:`${entity.name} route`,visible:entity.visible,
    points:roundedRoutePoints(route),width:route.width,surface:'gravel',elevationMode:'terrain'} : undefined;
}

/** Build a replacement without mutating the project or committing unfinished clicks. */
export function createCharacterRoute(project:Project,characterId:string,points:PathPoint[],width:number,cornerRounding?:number[]):Instance {
  const entity=project.entities.find(entity=>entity.id===characterId);
  const asset=entity?.kind==='instance' ? project.assets.find(asset=>asset.id===entity.assetId) : undefined;
  if(entity?.kind!=='instance'||!asset||assetAnimation(asset)!=='person-walk-v1') throw new Error('Select a person before drawing a walking route.');
  if(points.length<2) throw new Error('Click a start and an end before finishing the route.');
  const walkingRoute=walkingRouteSchema.parse({points:points.map(point=>[...point]),width,...(cornerRounding ? {cornerRounding}: {})});
  const issue=walkingRouteIssue(walkingRoute,project.site);if(issue)throw new Error(issue);
  return {...entity,walkingRoute};
}
