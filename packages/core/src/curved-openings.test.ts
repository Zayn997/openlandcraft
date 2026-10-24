import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject} from '@openlandcraft/project';
import {applyCommand,architectureIssue,copySelection,createCurvedWall,createSite,createWallChain,dragOpening,editOpening,Editor,openingAtPoint,openingCenter,openingDistanceAtPoint,openingSchema,parseProject,pasteSelection,updateCurvedWall,wallLength,wallPathPoint,type Level,type Opening,type Wall} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[4,3,-5],rotation:37};
const ring=(clockwise=false)=>createCurvedWall(level.id,'circle',[[0,0],[5,0]],.6,6,clockwise,1,'ring');
const door:Opening={id:'gate',kind:'door',offset:3,width:2,height:3,sill:0,shape:'arch',archRise:1};
const window:Opening={id:'slit',kind:'window',offset:8,width:.6,height:1.5,sill:2};
const scene=(...walls:Wall[])=>parseProject({...createSite({name:'Castle apertures',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...walls]});
const wallOf=(editor:Editor,id='ring')=>editor.getSnapshot().project.entities.find((w):w is Wall=>w.kind==='wall'&&w.id===id)!;
const world=(x:number,z:number):[number,number,number]=>{const a=level.rotation*Math.PI/180;return [level.position[0]+x*Math.cos(a)+z*Math.sin(a),8,level.position[2]-x*Math.sin(a)+z*Math.cos(a)];};

describe('shared editable rectangular / arched wall openings',()=>{
  it('uses centerline distance for placement on rotated circles and both arc directions',()=>{
    for(const clockwise of [false,true]){
      const w=createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.4,6,clockwise,1,'arc'),p=wallPathPoint(w,.5);
      const result=openingAtPoint(w,level,world(...p),{kind:'door',width:2,height:3,sill:9,shape:'arch',archRise:1,snapping:false},'gate',[w]);
      expect(result.issue).toBeNull();expect(result.opening!.offset).toBeCloseTo(wallLength(w)/2-1);expect(result.opening!.sill).toBe(0);expect(result.opening!.shape).toBe('arch');
    }
    const w=ring(),p=wallPathPoint(w,.25),result=openingAtPoint(w,level,world(...p),{...window,snapping:true},'slit',[w]);
    expect(result.issue).toBeNull();expect(result.opening!.offset*10).toBeCloseTo(Math.round(result.opening!.offset*10));
  });
  it('keeps IDs, angular centers and physical widths on radius edits, undo, redo and portable reopening',()=>{
    const w={...ring(),openings:[door,window]},editor=new Editor(scene(w)),before=editor.getSnapshot().project;
    editor.execute({type:'replace',entity:updateCurvedWall(w,{radius:7,center:[1,2]})},'Resize tower');
    const next=wallOf(editor);for(const o of next.openings!){const old=w.openings.find(a=>a.id===o.id)!;expect((o.offset+o.width/2)/7).toBeCloseTo((old.offset+old.width/2)/5);expect(o.width).toBe(old.width);expect(o.shape).toBe(old.shape);expect(o.height).toBe(old.height);}
    const saved=editor.getSnapshot().project;expect(deserializeProject(serializeProject(saved))).toEqual(saved);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(editor.getSnapshot().project).toEqual(saved);
  });
  it('reuses move, resize and shape edits without replacing sibling openings',()=>{
    const w={...ring(),openings:[door,window]},moved=dragOpening(w,door.id,'move',1.03,true),resized=dragOpening(moved,door.id,'end',.5,false);
    expect(resized.openings![0].id).toBe(door.id);expect(resized.openings![0].shape).toBe('arch');expect(resized.openings![0].width).toBe(2.5);expect(resized.openings![1]).toBe(window);
    expect(editOpening(w,door.id,{shape:'rectangle'}).openings![0].archRise).toBeUndefined();expect(()=>editOpening(w,door.id,{height:.8})).toThrow('Arch rise');
  });
  it('rejects shrinking into sibling openings, arc ends, invalid host distances or a wall top atomically',()=>{
    const w={...ring(),openings:[door,{...window,offset:5.2}]},editor=new Editor(scene(w)),before=editor.getSnapshot();
    expect(()=>editor.execute({type:'replace',entity:updateCurvedWall(w,{radius:2})},'Shrink')).toThrow();expect(editor.getSnapshot()).toBe(before);
    const arc={...createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.3,6,false,1,'arc'),openings:[{...door,offset:4.5}]};
    expect(()=>applyCommand(scene(arc),{type:'replace',entity:updateCurvedWall(arc,{sweepAngle:65})})).toThrow();
    expect(architectureIssue([{...w,openings:[{...door,offset:wallLength(w)+.1}]}])).toContain('fit');expect(architectureIssue([{...w,openings:[{...door,height:6}]}])).toContain('wall top');
  });
  it('protects openings from mixed-thickness joins on either side of curved hosts',()=>{
    const w={...ring(),openings:[door]},p=wallPathPoint(w,4/wallLength(w)),outside=wallPathPoint(w,4/wallLength(w),-4),b=createWallChain(scene(w),level.id,[outside,p],false,'branch',false,.2)[0];
    expect(()=>applyCommand(scene(w),{type:'add',entity:b})).toThrow('door or window');
  });
  it('retains editable arches when copying individual openings and entire curved walls',()=>{
    const w={...ring(),openings:[door]},p=scene(w),single=pasteSelection(p,copySelection(p,w.id,[],{wallId:w.id,openingId:door.id}),w.id,'copy');
    const next=applyCommand(p,single.command).entities.find((e):e is Wall=>e.kind==='wall'&&e.id===w.id)!;expect(next.openings!.find(o=>o.id===single.focus!.openingId)!.shape).toBe('arch');
    const copied=applyCommand(p,pasteSelection(p,copySelection(p,w.id),null,'wall-copy').command).entities.find((e):e is Wall=>e.kind==='wall'&&e.id!==w.id)!;
    expect(copied.openings![0].id).not.toBe(door.id);expect(copied.openings![0].archRise).toBe(1);
    const drag=pasteSelection(p,{kind:'opening',opening:door},w.id,'drag',1,{worldDelta:[0,4],snapping:false});expect(()=>applyCommand(p,drag.command)).not.toThrow();
  });
  it('upgrades format 19 unchanged and rejects arch fields masquerading as old format data',()=>{
    const p=scene(ring()),legacy={...p,version:19},snapshot=structuredClone(legacy);expect(parseProject(legacy)).toEqual({...p,version:32});expect(legacy).toEqual(snapshot);
    expect(()=>parseProject({...legacy,entities:[level,{...ring(),openings:[door]}]})).toThrow();expect(openingSchema.safeParse({...door,archRise:4}).success).toBe(false);
    expect(openingAtPoint(ring(),level,world(0,5),{...door,archRise:NaN,snapping:false},'invalid').opening).toBeNull();
  });
  it('unwraps drag positions across a circle seam and follows center moves without changing offsets',()=>{
    const w={...ring(),openings:[door]},a=openingDistanceAtPoint(w,wallPathPoint(w,.99),-.2);expect(a).toBeCloseTo(-wallLength(w)*.01);
    const moved=updateCurvedWall(w,{center:[2,3]});expect(moved.openings).toBe(w.openings);const before=openingCenter(w,door),after=openingCenter(moved,door);expect(after[0]-before[0]).toBeCloseTo(2);expect(after[1]-before[1]).toBeCloseTo(3);
  });
  it('places one editable arch across the circular seam and protects it from overlaps and joins',()=>{
    const w=ring(),length=wallLength(w),result=openingAtPoint(w,level,world(5,0),{...door,snapping:false},'gate',[w]);
    expect(result.issue).toBeNull();expect(result.opening!.offset).toBeCloseTo(length-1);
    const host={...w,openings:[result.opening!]};expect(architectureIssue([host])).toBeNull();
    expect(architectureIssue([{...host,openings:[...host.openings,{...door,id:'overlap',offset:.1,width:.5}]}])).toContain('between');
    const b=createWallChain(scene(host),level.id,[[10,0],[5,0]],false,'branch',false,.2)[0];expect(()=>applyCommand(scene(host),{type:'add',entity:b})).toThrow('door or window');
    const changed=updateCurvedWall(host,{radius:7}),center=openingCenter(changed,changed.openings![0]);expect(center[0]).toBeCloseTo(7);expect(center[1]).toBeCloseTo(0);expect(changed.openings).toHaveLength(1);
    const moved=dragOpening(host,'gate','move',2,false);expect(moved.openings![0].offset).toBeCloseTo(1);expect(moved.openings![0].id).toBe('gate');
  });
  it('supports centerline offsets around the full circumference of large circular walls',()=>{
    const host={...updateCurvedWall(ring(),{radius:75}),openings:[{...door,offset:400}]};expect(()=>scene(host)).not.toThrow();
  });
  it('carries opening angles when editing a connected straight corner refits an arc radius',()=>{
    const arc={...createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.4,6,false,1,'arc'),openings:[{...door,offset:2,width:1,archRise:.5}]};
    const straight:Wall={...arc,id:'straight',curve:undefined,start:arc.end,end:[0,10],openings:[]},editor=new Editor(scene(arc,straight));
    editor.execute({type:'replace',entity:{...straight,start:[1,5]}},'Move joined corner');
    const changed=wallOf(editor,'arc'),o=changed.openings![0];expect(o.id).toBe(door.id);expect((o.offset+o.width/2)/changed.curve!.radius).toBeCloseTo(2.5/5);expect(o.width).toBe(1);
  });
});
