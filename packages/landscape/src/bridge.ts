import {terrainTriangleHeight,type SiteSurface,type SurfaceSite} from './surface-elevation';
import type {PathPoint} from './path';

export type BridgeSettings={thickness:number;approachLength:number;abutmentLength:number;railingHeight:number};
export type BridgeSurface=SiteSurface&{bridge?:BridgeSettings};
export function bridgeStation(surface:SiteSurface,point:PathPoint){
  const [a,b]=surface.points,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),tx=dx/length,tz=dz/length;
  return {length,tx,tz,along:(point[0]-a[0])*tx+(point[1]-a[1])*tz,across:-(point[0]-a[0])*tz+(point[1]-a[1])*tx};
}
export function bridgeHeight(surface:BridgeSurface,site:SurfaceSite,point:PathPoint){
  const {length,along}=bridgeStation(surface,point),ramp=surface.bridge!.approachLength,deck=surface.elevation!;
  if(along<ramp)return terrainTriangleHeight(site,surface.points[0])+(deck-terrainTriangleHeight(site,surface.points[0]))*Math.max(0,along)/ramp;
  if(along>length-ramp)return terrainTriangleHeight(site,surface.points[1])+(deck-terrainTriangleHeight(site,surface.points[1]))*Math.max(0,length-along)/ramp;
  return deck;
}
/** Require the whole body to fit between the rails and both bank endpoints. */
export function bridgeContains(surface:BridgeSurface,point:PathPoint,radius=0){
  const {along,across,length}=bridgeStation(surface,point);
  return along>=radius&&along<=length-radius&&Math.abs(across)+radius<=(surface.width??0)/2-.12;
}
