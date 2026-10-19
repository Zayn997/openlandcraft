import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { copySelection, pasteSelection, type Editor, type EditorClipboard, type Project } from '@openlandcraft/core';

export type CopyResult = Pick<ReturnType<typeof pasteSelection>, 'selectedIds' | 'focus'>;
type Props = { editor: Editor; enabled: boolean; selectedId: string | null; selectedIds: string[]; snapping: boolean; onPlaced: (result: CopyResult) => void; onStatus: (message: string) => void };
type Orbit = { enabled: boolean };
type Drag = { pointer: number; screen: [number,number]; plane: THREE.Plane; origin: THREE.Vector3; sourceId: string; clipboard: EditorClipboard; project: Project; prefix: string; moved: boolean; begun: boolean; valid: boolean; displaced: boolean; issue: string; result?: CopyResult; orbit: Orbit | null; orbitEnabled: boolean; snapping: boolean };

/** Capture Alt gestures before orbit, edit handles or transform controls receive them. */
export function DragCopy(props: Props) {
  const { gl, camera, scene, controls } = useThree();
  const latest = useRef(props); latest.current = props;
  const active = useRef<Drag | null>(null);
  useEffect(() => {
    const canvas = gl.domElement, raycaster = new THREE.Raycaster();
    let suppressClick = false;
    const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    const restore = (drag: Drag) => { if (canvas.hasPointerCapture(drag.pointer)) canvas.releasePointerCapture(drag.pointer); if (drag.orbit) drag.orbit.enabled = drag.orbitEnabled; canvas.style.cursor = ''; };
    const cancel = () => { const drag = active.current; if (!drag) return; active.current = null; if (drag.begun) props.editor.cancel(); restore(drag); latest.current.onStatus('Copy cancelled. The original is unchanged.'); };
    const ray = (event: PointerEvent) => { const r = canvas.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),camera); return raycaster.ray; };
    const metadata = (hit: THREE.Intersection): { id:string; openingId?:string } | null => {
      let id: string | undefined, openingId: string | undefined;
      for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) {
        if (!object.visible) return null;
        if (!id) id = object.userData.copyEntityId ?? (hit.instanceId !== undefined ? object.userData.copyInstanceIds?.[hit.instanceId] : undefined);
        if (!openingId) openingId = object.userData.copyOpeningId;
      }
      return id ? { id, openingId } : null;
    };
    const down = (event: PointerEvent) => {
      suppressClick = false;
      if (!event.altKey || event.button !== 0 || !latest.current.enabled || active.current) return;
      const state = props.editor.getSnapshot();
      if (state.gestureLabel) { block(event); latest.current.onStatus('Finish or cancel the current edit before Alt-dragging a copy.'); return; }
      ray(event); scene.updateMatrixWorld(true);
      const hits = raycaster.intersectObjects(scene.children,true).filter(hit => {
        for (let object: THREE.Object3D | null = hit.object; object; object=object.parent) if (!object.visible) return false;
        if (!(hit.object instanceof THREE.Mesh)) return false;
        // TransformControls' scene-wide drag plane has a visible Object3D but
        // an invisible material. It must not steal picks from actual elements.
        // Keep opacity-zero opening hit surfaces: those are intentional targets.
        const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex ?? 0] : hit.object.material;
        return material?.visible !== false;
      });
      const hit = hits[0], picked = hit && metadata(hit);
      if (!picked) return;
      block(event); suppressClick = true;
      try {
        const selected = state.project.entities.find(e=>e.id===latest.current.selectedId);
        const entity = state.project.entities.find(e=>e.id===picked.id);
        const level = entity && state.project.entities.find(e=>e.kind==='level'&&e.id===entity.parentId);
        const group = selected && (selected.kind==='unit'&&selected.memberIds.includes(picked.id) || selected.kind==='level'&&entity?.parentId===selected.id || selected.kind==='building'&&level?.kind==='level'&&level.buildingId===selected.id);
        const multiple = !group && !picked.openingId && latest.current.selectedIds.includes(picked.id) ? latest.current.selectedIds : [];
        const sourceId = group ? selected!.id : picked.id;
        const focus = !group && picked.openingId ? {wallId:picked.id,openingId:picked.openingId} : undefined;
        const clipboard = copySelection(state.project,sourceId,multiple,focus);
        if (Math.abs(raycaster.ray.direction.y)<0.03) throw new Error('Tilt the view down to drag a copy on the horizontal plane.');
        const plane = new THREE.Plane(new THREE.Vector3(0,1,0),-hit.point.y);
        const origin = raycaster.ray.intersectPlane(plane,new THREE.Vector3())!;
        const orbit = controls as unknown as Orbit | null;
        active.current = {pointer:event.pointerId,screen:[event.clientX,event.clientY],plane,origin,sourceId,clipboard,project:state.project,prefix:crypto.randomUUID(),moved:false,begun:false,valid:false,displaced:false,issue:'',orbit,orbitEnabled:orbit?.enabled??true,snapping:latest.current.snapping};
        if (orbit) orbit.enabled=false;
        canvas.setPointerCapture(event.pointerId); canvas.style.cursor='copy';
        latest.current.onStatus('Drag to position a copy. Release to place; Escape cancels.');
      } catch(error) { latest.current.onStatus(error instanceof Error?error.message:'Cannot copy this element.'); }
    };
    const move = (event: PointerEvent) => {
      const drag=active.current; if (!drag || event.pointerId!==drag.pointer) return;
      block(event);
      if (!drag.moved && Math.hypot(event.clientX-drag.screen[0],event.clientY-drag.screen[1])<4) return;
      drag.moved=true;
      if (!drag.begun) { drag.begun=true; props.editor.begin('Alt-drag copy'); }
      try {
        const pointerRay=ray(event), point=pointerRay.intersectPlane(drag.plane,new THREE.Vector3());
        if (!point || Math.abs(pointerRay.direction.y)<0.03) throw new Error('Keep the pointer on the placement plane.');
        const delta=point.sub(drag.origin);
        const result=pasteSelection(drag.project,drag.clipboard,drag.sourceId,drag.prefix,0,{worldDelta:[delta.x,delta.z],snapping:drag.snapping});
        props.editor.preview(result.command); drag.result=result; drag.valid=true;
        drag.displaced=result.displaced??false;
        canvas.style.cursor='copy'; latest.current.onStatus('Copy preview. Release to place; Escape cancels.');
      } catch(error) {
        drag.valid=false;
        drag.issue=(error as {issues?:{message:string}[]})?.issues?.[0]?.message ?? (error instanceof Error?error.message:'Invalid copy position.');
        canvas.style.cursor='not-allowed'; latest.current.onStatus(drag.issue+' Release here cancels the copy.');
      }
    };
    const up = (event: PointerEvent) => {
      const drag=active.current; if (!drag || event.pointerId!==drag.pointer) return;
      move(event); block(event); active.current=null;
      if (drag.begun && drag.valid && drag.displaced && drag.result) {
        props.editor.commit(); restore(drag); latest.current.onPlaced(drag.result); latest.current.onStatus('Copy placed. Undo removes this copy; the original is unchanged.');
      } else { if(drag.begun)props.editor.cancel();restore(drag);latest.current.onStatus(drag.moved&&!drag.valid?'Copy cancelled: '+drag.issue:'No copy placed. Drag to a new position.'); }
    };
    const click = (event: MouseEvent) => { if(suppressClick){suppressClick=false;block(event);} };
    const escape = (event: KeyboardEvent) => { if(event.key==='Escape')cancel(); };
    const unsubscribe=props.editor.subscribe(()=>{if(active.current?.begun&&!props.editor.getSnapshot().gestureLabel)cancel();});
    canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('click',click,true);
    canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',escape,true);
    return ()=>{unsubscribe();cancel();canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('click',click,true);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('lostpointercapture',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',escape,true);};
  },[gl,camera,scene,controls,props.editor]);
  return null;
}

