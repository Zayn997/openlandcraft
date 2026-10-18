/** Bound the extra color/depth pass by its longest edge, including portrait displays. */
export function opticsSize(width: number, height: number, dpr: number, quality: 'high' | 'low'): [number, number] {
  const cap=quality==='high'?1280:768,scale=quality==='high'?0.65:0.5;
  const factor=Math.min(scale*dpr,cap/Math.max(width,height));
  return [Math.max(1,Math.round(width*factor)),Math.max(1,Math.round(height*factor))];
}
