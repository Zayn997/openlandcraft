import {z} from 'zod';
import type {Opening} from './model';
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/),materialId=z.string().min(1).max(100).optional();
export const openingJoinerySchema=z.object({
 frame:z.object({width:z.number().finite().min(.02).max(.5),depth:z.number().finite().min(.02).max(.5),color,materialId}).strict().optional(),
 panel:z.object({thickness:z.number().finite().min(.02).max(.2),color,materialId}).strict().optional(),
 glass:z.object({thickness:z.number().finite().min(.005).max(.05),color,opacity:z.number().finite().min(.05).max(.8)}).strict().optional(),
}).strict();
export type OpeningJoinery=z.infer<typeof openingJoinerySchema>;
export const defaultOpeningJoinery=(kind:'door'|'window'):OpeningJoinery=>({frame:{width:.08,depth:.14,color:'#85613f'},...(kind==='door'?{panel:{thickness:.06,color:'#9b7045'}}:{glass:{thickness:.016,color:'#a5cbd3',opacity:.3}})});
export function openingJoineryIssue(o:Pick<Opening,'kind'|'width'|'height'|'shape'|'archRise'|'joinery'>):string|null{
 const j=o.joinery;if(!j)return null;
 if(j.panel&&o.kind!=='door'||j.glass&&o.kind!=='window')return 'Door panels belong to doors; glass belongs to windows.';
 const border=j.frame?.width??0;
 if(o.width-2*border<.1||o.height-border*(o.kind==='window'?2:1)<.1||o.shape==='arch'&&o.archRise!-border<.03-1e-8)return 'Reduce frame width to leave a clear opening and at least 0.03 m of inner arch rise.';
 return null;
}
/** Inner profiles reuse the host's rectangular/elliptical arch convention. */
export function insetOpening(o:Opening,side:number,bottom=side):Opening{
 return {...o,offset:o.offset+side,width:o.width-2*side,sill:o.sill+bottom,height:o.height-side-bottom,...(o.shape==='arch'?{archRise:o.archRise!-side}:{})};
}
