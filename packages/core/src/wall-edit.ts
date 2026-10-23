import { architectureIssue, type PlanPoint } from './architecture';
import { wallSchema, type Wall } from './model';
import { curvePoint, updateCurvedWall, isCircularWall } from './curved-walls';

export type WallDragMode = 'move' | 'start' | 'end' | 'radius';
/** Local level-plane delta from the original grab, never the previous preview. */
export function dragWall(wall: Wall, mode: WallDragMode, delta: PlanPoint, snapping: boolean): Wall {
  if (!delta.every(Number.isFinite)) throw new Error('Keep the pointer on the wall editing plane.');
  const snap = (n: number) => Number((snapping ? Math.round(n * 4) / 4 : n).toFixed(10));
  const shift: PlanPoint = mode === 'move' ? delta.map(snap) as PlanPoint : delta;
  const point = (p: PlanPoint): PlanPoint => p.map((n, i) => mode === 'move' ? Number((n + shift[i]).toFixed(10)) : snap(n + shift[i])) as PlanPoint;
  if (wall.curve) {
    const c=wall.curve;
    let next:Wall;
    if(mode==='move') next=updateCurvedWall(wall,{center:point(c.center)});
    else if(mode==='radius') {
      const handle=curvePoint(c,0.5),target=point(handle);
      next=updateCurvedWall(wall,{radius:snap(Math.hypot(target[0]-c.center[0],target[1]-c.center[1]))});
    } else {
      const target=point(wall[mode]);
      if(Math.hypot(target[0]-c.center[0],target[1]-c.center[1])<0.2)throw new Error('Keep the arc endpoint direction away from its center.');
      const angle=Math.atan2(target[1]-c.center[1],target[0]-c.center[0])*180/Math.PI;
      if(isCircularWall(wall))next=updateCurvedWall(wall,{startAngle:angle});
      else {
        const start=mode==='start'?angle:c.startAngle,end=mode==='end'?angle:c.startAngle+c.sweepAngle;
        const sweep=c.sweepAngle>0?((end-start)%360+360)%360:-((start-end)%360+360)%360;
        next=updateCurvedWall(wall,{startAngle:start,sweepAngle:sweep});
      }
    }
    const parsed=wallSchema.safeParse(next),issue=parsed.success?architectureIssue([{...next,junctions:undefined}]):'Keep the curved wall dimensions within the supported range.';
    if(issue)throw new Error(issue);return next;
  }
  if(mode==='radius')throw new Error('A straight wall has no radius.');
  const next = { ...wall, start: mode === 'end' ? wall.start : point(wall.start), end: mode === 'start' ? wall.end : point(wall.end) };
  const parsed = wallSchema.safeParse(next);
  if (!parsed.success || Math.hypot(next.end[0] - next.start[0], next.end[1] - next.start[1]) < 0.2) throw new Error('Keep wall endpoints within ±100 m and the wall at least 0.2 m long.');
  const issue = architectureIssue([{...next,junctions:undefined}]); // Full joined-scene validation happens in the command.
  if (issue) throw new Error(issue);
  return next;
}
