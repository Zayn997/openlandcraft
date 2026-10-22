import {describe,expect,it} from 'vitest';
import {roundedRoutePoints,routeCorner,walkingRouteIssue,type RoundedRoute} from './rounded-route';
import {pathIssue,pathLength} from './path';

const route:RoundedRoute={points:[[-10,0],[0,0],[0,10]],width:2,cornerRounding:[0,1,0]};
describe('rounded walking route corners',()=>{
  it('keeps sharp routes and authored anchor positions unchanged',()=>{
    const sharp={...route,cornerRounding:undefined};expect(roundedRoutePoints(sharp)).toBe(sharp.points);
    const before=structuredClone(route);roundedRoutePoints(route);expect(route).toEqual(before);
  });
  it('creates a tangent circular fillet, with the same endpoints and a shorter curved route',()=>{
    const corner=routeCorner(route,1)!,points=roundedRoutePoints(route);
    expect(corner.turn).toBeCloseTo(90);expect(corner.radius).toBeCloseTo(4.5);expect(corner.start).toEqual([-4.5,0]);expect(corner.end).toEqual([0,4.5]);
    expect(points[0]).toEqual(route.points[0]);expect(points.at(-1)).toEqual(route.points.at(-1));
    points.slice(1,-1).forEach(point=>expect(Math.hypot(point[0]-corner.center[0],point[1]-corner.center[1])).toBeCloseTo(corner.radius,8));
    expect(pathLength(points)).toBeLessThan(pathLength(route.points));expect(walkingRouteIssue(route,{width:50,depth:40})).toBeNull();
  });
  it('handles right turns and limits nearby corners without overlapping their fillets',()=>{
    const right={...route,points:[[-10,0],[0,0],[0,-10]] as [number,number][]};expect(routeCorner(right,1)!.sweep).toBeLessThan(0);expect(walkingRouteIssue(right,{width:50,depth:40})).toBeNull();
    const chain:RoundedRoute={points:[[-15,0],[0,0],[0,8],[15,8]],width:2,cornerRounding:[0,1,1,0]},a=routeCorner(chain,1)!,b=routeCorner(chain,2)!;
    expect(a.end[1]).toBeLessThan(b.start[1]);expect(walkingRouteIssue(chain,{width:50,depth:40})).toBeNull();
  });
  it('keeps the corridor valid across slider values and identifies corners too tight to round',()=>{
    for(const value of [.01,.1,.5,.9,1])expect(walkingRouteIssue({...route,cornerRounding:[0,value,0]},{width:50,depth:40})).toBeNull();
    const tight:RoundedRoute={points:[[-2,0],[0,0],[0,2]],width:3,cornerRounding:[0,1,0]};expect(routeCorner(tight,1)?.canRound).toBe(false);expect(roundedRoutePoints(tight)).toEqual(tight.points);
    expect(routeCorner(route,0)).toBeNull();expect(routeCorner(route,2)).toBeNull();
  });
  it('accepts short generated curve samples without relaxing authored anchor limits',()=>{
    const points=roundedRoutePoints(route);expect(pathIssue({points,width:route.width},{width:50,depth:40})).not.toBeNull();
    expect(pathIssue({points,width:route.width},{width:50,depth:40},{sampled:true})).toBeNull();
    expect(walkingRouteIssue({...route,points:[[-.5,0],[0,0],[0,10]]},{width:50,depth:40})).toMatch(/1 m/);
  });
});
