import type { Wall } from './model';
import type { PlanPoint } from './architecture';

export type WallShape = 'straight' | 'arc' | 'circle';
export type WallCurve = NonNullable<Wall['curve']>;
const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (radians: number) => radians * 180 / Math.PI;
const normalize = (angle: number) => (angle % 360 + 360) % 360;

/** Angles follow the level's X/Z plane. Radius is always measured to the centerline. */
export function curvePoint(curve: WallCurve, fraction: number, radius = curve.radius): PlanPoint {
  const angle = radians(curve.startAngle + curve.sweepAngle * fraction);
  return [curve.center[0] + radius * Math.cos(angle), curve.center[1] + radius * Math.sin(angle)];
}
export const isCircularWall = (wall: Wall) => !!wall.curve && Math.abs(wall.curve.sweepAngle) === 360;
export function curvedWallDistance(wall:Wall,point:PlanPoint):number{
  if(!wall.curve)throw new Error('Choose a curved wall.');
  const c=wall.curve,angle=degrees(Math.atan2(point[1]-c.center[1],point[0]-c.center[0]));
  const along=c.sweepAngle>0?normalize(angle-c.startAngle):normalize(c.startAngle-angle);
  if(along<=Math.abs(c.sweepAngle)+1e-8)return Math.abs(Math.hypot(point[0]-c.center[0],point[1]-c.center[1])-c.radius);
  return Math.min(...[wall.start,wall.end].map(p=>Math.hypot(p[0]-point[0],p[1]-point[1])));
}
export function updateCurvedWall(wall: Wall, patch: Partial<WallCurve>): Wall {
  if (!wall.curve) throw new Error('Choose an arc or circular wall.');
  const curve = { ...wall.curve, ...patch };
  const ratio=curve.radius/wall.curve.radius;
  const length=2*Math.PI*curve.radius;
  const openings=ratio===1?wall.openings:wall.openings?.map(o=>{const offset=(o.offset+o.width/2)*ratio-o.width/2;return {...o,offset:Math.abs(curve.sweepAngle)===360?((offset%length)+length)%length:offset};});
  return { ...wall, curve, openings, start: curvePoint(curve, 0), end: curvePoint(curve, 1) };
}
/** Center, radius/start point, then end direction. The last click fixes the arc sweep. */
export function createCurvedWall(parentId: string, shape: 'arc' | 'circle', points: PlanPoint[], thickness: number, height: number, clockwise = false, elevation = 0.2, id:string = crypto.randomUUID()): Wall {
  if (points.length < (shape === 'circle' ? 2 : 3)) throw new Error(shape === 'circle' ? 'Choose a center and radius point.' : 'Choose a center, start point and end direction.');
  if (!points.flat().every(Number.isFinite)) throw new Error('Choose finite points on the drawing level.');
  const center: PlanPoint = [...points[0]], radius = Math.hypot(points[1][0] - center[0], points[1][1] - center[1]);
  const startAngle = normalize(degrees(Math.atan2(points[1][1] - center[1], points[1][0] - center[0])));
  let sweepAngle = 360;
  if (shape === 'arc') {
    if (Math.hypot(points[2][0] - center[0], points[2][1] - center[1]) < 0.2) throw new Error('Choose an end direction away from the center.');
    const end = normalize(degrees(Math.atan2(points[2][1] - center[1], points[2][0] - center[0])));
    sweepAngle = clockwise ? -normalize(startAngle - end) : normalize(end - startAngle);
  }
  if (radius < 0.25 || radius > 100 || radius <= thickness / 2 + 0.1) throw new Error('Choose a radius from 0.25–100 m with at least 0.1 m of clear inner radius.');
  if (Math.abs(sweepAngle) < 1 || radians(Math.abs(sweepAngle)) * radius < 0.2) throw new Error('Draw an arc of at least 1° and 0.2 m. Use Circle for a complete ring.');
  const curve: WallCurve = { center, radius, startAngle, sweepAngle };
  return { id, kind: 'wall', parentId, name: shape === 'circle' ? 'Circular wall' : 'Arc wall', visible: true, color: '#e4ded1', joins: true, openings: [], thickness, height, elevation, curve, start: curvePoint(curve, 0), end: curvePoint(curve, 1) };
}
/** Include extrema after level rotation so framing/copy bounds never collapse a ring to its seam. */
export function curvedWallPoints(wall: Wall, rotation = 0): PlanPoint[] {
  if (!wall.curve) return [wall.start, wall.end];
  const curve = wall.curve, fractions = [0, 1];
  for (let angle = -720; angle <= 1080; angle += 90) {
    const t = (angle + rotation - curve.startAngle) / curve.sweepAngle;
    if (t > 0 && t < 1) fractions.push(t);
  }
  return fractions.map(t => curvePoint(curve, t));
}
