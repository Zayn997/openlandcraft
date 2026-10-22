import {useEffect,useRef} from 'react';

/** Distinguish a deliberate point click from camera navigation, including a
 * drag that returns to its starting position and synthetic clicks after pinch. */
export class DrawingGesture {
  private pointers=new Map<number,{x:number;y:number}>();
  private blocked=false;
  private ready=false;
  down(id:number,button:number,x:number,y:number){
    if(!this.pointers.size){this.blocked=button!==0;this.ready=false;}
    else this.blocked=true;
    this.pointers.set(id,{x,y});
  }
  move(id:number,x:number,y:number){
    const start=this.pointers.get(id);
    if(start&&Math.hypot(x-start.x,y-start.y)>4)this.blocked=true;
  }
  up(id:number,button:number,x:number,y:number){
    if(!this.pointers.has(id))return;
    this.move(id,x,y);this.pointers.delete(id);
    this.ready=!this.blocked&&button===0&&!this.pointers.size;
  }
  wheel(){this.blocked=true;this.ready=false;}
  cancel(id?:number){
    if(id!==undefined&&!this.pointers.has(id))return;
    if(id===undefined)this.pointers.clear();else this.pointers.delete(id);
    this.blocked=true;this.ready=false;
  }
  consume(button:number){const allowed=this.ready&&button===0;this.ready=false;return allowed;}
}

export function useDrawingClick(canvas:HTMLCanvasElement,enabled:boolean){
  const gesture=useRef(new DrawingGesture());
  useEffect(()=>{
    const current=gesture.current=new DrawingGesture();if(!enabled)return;
    const down=(event:PointerEvent)=>current.down(event.pointerId,event.button,event.clientX,event.clientY);
    const move=(event:PointerEvent)=>current.move(event.pointerId,event.clientX,event.clientY);
    const up=(event:PointerEvent)=>current.up(event.pointerId,event.button,event.clientX,event.clientY);
    const cancel=(event:PointerEvent)=>current.cancel(event.pointerId),blur=()=>current.cancel(),wheel=()=>current.wheel();
    // Capture before OrbitControls processes navigation or releases pointer capture.
    canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);
    canvas.addEventListener('pointercancel',cancel,true);canvas.addEventListener('lostpointercapture',cancel,true);canvas.addEventListener('wheel',wheel,{capture:true,passive:true});window.addEventListener('blur',blur);
    return()=>{
      canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);
      canvas.removeEventListener('pointercancel',cancel,true);canvas.removeEventListener('lostpointercapture',cancel,true);canvas.removeEventListener('wheel',wheel,true);window.removeEventListener('blur',blur);current.cancel();
    };
  },[canvas,enabled]);
  return (button:number)=>!enabled||gesture.current.consume(button);
}
