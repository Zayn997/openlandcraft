import type {AnimationClip} from 'three';

export const HORSE_WALK_DURATION=32/30;
// Distance covered by one authored cycle at the library horse's natural size.
export const HORSE_STRIDE_METRES=1.12;

/** horse-walk-v1 was exported over 64 frames, but its loop ends at frame 32.
 * Fix on load so already saved projects benefit without rewriting asset data. */
export function horseWalkClip(clip:AnimationClip){
  if(clip.name!=='Walk'||Math.abs(clip.duration-64/30)>.001)return clip;
  const corrected=clip.clone();
  const end=clip.tracks.flatMap(track=>Array.from(track.times)).find(time=>Math.abs(time-HORSE_WALK_DURATION)<.0001);
  if(end===undefined)return clip;
  corrected.duration=end;corrected.trim();return corrected;
}
