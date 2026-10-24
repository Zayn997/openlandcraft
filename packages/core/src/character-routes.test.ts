/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createSite,createPlacedInstance,createPath,createCharacterRoute,characterWalkingPath,groundRoutes,encodeGlb,Editor,parseProject,copySelection,pasteSelection,scatterInstances,type Instance} from './index';
import {serializeProject,deserializeProject} from '@openlandcraft/project';

const assets=['person-male','person-female','horse'].map(id=>({id,name:id,data:encodeGlb(readFileSync(new URL(`../../../apps/web/public/models/characters/${id}.glb`,import.meta.url))),attribution:''}));
function scene(){
  const project=createSite({name:'Personal routes',width:60,depth:50,resolution:129,preset:'flat'});project.assets=assets;
  const a=createPlacedInstance(project,assets[0],-14,-8,false,'blue'),b=createPlacedInstance(project,assets[1],-14,8,false,'rust');
  project.entities=[a,b];return {project,a,b};
}

describe('independent character routes',()=>{
  it('saves rounded corners as editable anchors and commits a slider drag as one undo step',()=>{
    const {project,a,b}=scene(),points:[number,number][]=[[-18,-8],[0,-8],[0,12]];
    const sharp=createCharacterRoute(project,a.id,points,3);project.entities=[sharp,b];
    const editor=new Editor(project);editor.begin('Round walking route corner');
    for(const amount of [.2,.5,1])editor.preview({type:'replace',entity:createCharacterRoute(project,a.id,points,3,[0,amount,0])});
    expect(editor.getSnapshot().past).toHaveLength(0);editor.commit();expect(editor.getSnapshot().past).toHaveLength(1);
    const saved=deserializeProject(serializeProject(editor.getSnapshot().project)),rounded=saved.entities[0] as Instance;
    expect(rounded.walkingRoute).toEqual({points,width:3,cornerRounding:[0,1,0]});
    const curve=characterWalkingPath(rounded)!.points;expect(curve.length).toBeGreaterThan(3);expect(curve).not.toContainEqual(points[1]);
    expect(saved.entities[1]).toEqual(b);expect(groundRoutes(saved).get(a.id)?.path).toBeDefined();
    editor.undo();expect(editor.getSnapshot().project.entities[0]).toEqual(sharp);editor.redo();
    editor.begin('Round walking route corner');editor.preview({type:'replace',entity:sharp});editor.cancel();
    expect(editor.getSnapshot().project.entities[0]).toEqual(rounded);
  });
  it('upgrades format 17 without changing independent routes and rejects malformed corner settings',()=>{
    const {project,a,b}=scene(),points:[number,number][]=[[-18,-8],[0,-8],[0,12]];
    const person=createCharacterRoute(project,a.id,points,3),legacy={...project,version:17,entities:[person,b]},before=structuredClone(legacy);
    const upgraded=parseProject(legacy);expect(upgraded.version).toBe(32);expect(upgraded.entities).toEqual(legacy.entities);expect(legacy).toEqual(before);
    for(const rounding of [[0,1],[1,0,0],[0,0,1],[0,1.1,0],[0,-.1,0]])expect(()=>createCharacterRoute(project,a.id,points,3,rounding)).toThrow();
  });
  it('draws only for the selected person, preserving the other person and landscape path through save, undo and redo',()=>{
    const {project,a,b}=scene(),landscape=createPath(project,[[-20,0],[20,0]]);project.entities.push(landscape);
    const editor=new Editor(project),before=editor.getSnapshot().project;
    const first=createCharacterRoute(before,a.id,[[-20,-8],[-4,-8],[12,-3]],3);
    expect(editor.getSnapshot().project).toBe(before);expect(editor.getSnapshot().past).toHaveLength(0);
    editor.execute({type:'replace',entity:first},'Draw blue route');
    const second=createCharacterRoute(editor.getSnapshot().project,b.id,[[-20,8],[0,8],[17,15]],2.5);
    editor.execute({type:'replace',entity:second},'Draw rust route');
    const saved=deserializeProject(serializeProject(editor.getSnapshot().project));
    expect(saved.version).toBe(32);expect(saved.entities.find(e=>e.id===a.id)).toEqual(first);expect(saved.entities.find(e=>e.id===b.id)).toEqual(second);
    expect(saved.entities.find(e=>e.id===landscape.id)).toEqual(landscape);
    expect(characterWalkingPath(first)?.id).not.toBe(characterWalkingPath(second)?.id);
    editor.undo();expect(editor.getSnapshot().project.entities.find(e=>e.id===a.id)).toEqual(first);expect(editor.getSnapshot().project.entities.find(e=>e.id===b.id)).toEqual(b);
    editor.redo();expect(editor.getSnapshot().project.entities.find(e=>e.id===b.id)).toEqual(second);
    editor.begin('Edit blue point');editor.preview({type:'replace',entity:{...first,walkingRoute:{...first.walkingRoute!,points:[[-18,-10],[-4,-8],[12,-3]]}}});
    expect(editor.getSnapshot().preview!.entities.find(e=>e.id===b.id)).toEqual(second);editor.cancel();
    expect(editor.getSnapshot().project.entities.find(e=>e.id===a.id)).toEqual(first);
    editor.execute({type:'replace',entity:{...first,walkingRoute:undefined}},'Remove blue route');
    const removed=deserializeProject(serializeProject(editor.getSnapshot().project));
    expect(groundRoutes(removed).get(a.id)?.reason).toBe('no-path');expect(groundRoutes(removed).get(b.id)?.path).toBeDefined();
  });
  it('never assigns the shared landscape path or another person’s route to a new person',()=>{
    const {project,a,b}=scene();project.entities=[createCharacterRoute(project,a.id,[[-20,-8],[15,-8]],3),b,createPath(project,[[-20,8],[20,8]])];
    const routes=groundRoutes(project);expect(routes.get(a.id)?.path?.graph.id).toBe(`character-route:${a.id}`);expect(routes.get(b.id)?.reason).toBe('no-path');
  });
  it('migrates old shared walking routes as independent copies without changing the source file',()=>{
    const {project,a,b}=scene(),landscape=createPath(project,[[-20,0],[20,0]]);
    const old={...project,version:16,entities:[landscape,{...a,characterAnimation:'walk' as const},{...b,characterAnimation:'walk' as const}]},snapshot=structuredClone(old);
    const migrated=parseProject(old),blue=migrated.entities.find(e=>e.id===a.id) as Instance,rust=migrated.entities.find(e=>e.id===b.id) as Instance;
    expect(old).toEqual(snapshot);expect(blue.walkingRoute).toEqual({points:landscape.points,width:landscape.width});expect(rust.walkingRoute).toEqual(blue.walkingRoute);
    expect(blue.walkingRoute).not.toBe(rust.walkingRoute);expect(blue.walkingRoute!.points).not.toBe(rust.walkingRoute!.points);
    expect(migrated.entities.find(e=>e.id===landscape.id)).toEqual(landscape);
    const changed=createCharacterRoute(migrated,a.id,[[-20,-8],[15,-8]],3);
    expect(changed.walkingRoute).not.toEqual(rust.walkingRoute);expect(parseProject(migrated)).toEqual(migrated);
    expect(()=>parseProject({...migrated,version:33})).toThrow();
  });
  it('rejects invalid routes and unsupported owners before changing history',()=>{
    const {project,a}=scene(),horse=createPlacedInstance(project,assets[2],0,0,false,'horse');project.entities.push(horse);
    expect(()=>createCharacterRoute(project,a.id,[[0,0]],3)).toThrow();
    expect(()=>createCharacterRoute(project,a.id,[[0,0],[40,0]],3)).toThrow();
    expect(()=>createCharacterRoute(project,a.id,[[0,0],[0,0]],3)).toThrow();
    expect(()=>createCharacterRoute(project,horse.id,[[-10,0],[10,0]],3)).toThrow(/person/);
    expect(()=>createCharacterRoute(project,'missing',[[-10,0],[10,0]],3)).toThrow();
    expect(()=>parseProject({...project,entities:[{...a,walkingRoute:{points:[[0,0],[40,0]],width:3}}]})).toThrow();
  });
  it('copies the route with the person and offsets the copied points independently',()=>{
    const {project,a}=scene(),person=createCharacterRoute(project,a.id,[[-20,-8],[10,-8]],3);project.entities=[person];
    const copy=pasteSelection(project,copySelection(project,a.id),null,'copy',1,{worldDelta:[2,3],snapping:false});
    if(copy.command.type!=='insert')throw new Error('Expected a copied person.');
    const clone=copy.command.entities[0] as Instance,dx=clone.position[0]-person.position[0],dz=clone.position[2]-person.position[2];
    expect(clone.id).not.toBe(person.id);expect(clone.walkingRoute!.points).toEqual(person.walkingRoute!.points.map(p=>[p[0]+dx,p[1]+dz]));
    expect(person.walkingRoute!.points).toEqual([[-20,-8],[10,-8]]);
    const scattered=scatterInstances(person,2,2,42,'scatter');
    for(const child of scattered){const dx=child.position[0]-person.position[0],dz=child.position[2]-person.position[2];child.walkingRoute!.points.forEach((p,i)=>{expect(p[0]).toBeCloseTo(person.walkingRoute!.points[i][0]+dx,12);expect(p[1]).toBeCloseTo(person.walkingRoute!.points[i][1]+dz,12);});}
  });
});
