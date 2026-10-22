import {describe,expect,it} from 'vitest';
import {DrawingGesture} from './drawing-gesture';

describe('point drawing versus navigation',()=>{
  it('adds one point for a primary click, tolerating normal hand movement',()=>{
    const gesture=new DrawingGesture();gesture.down(1,0,100,100);gesture.up(1,0,102,101);
    expect(gesture.consume(0)).toBe(true);expect(gesture.consume(0)).toBe(false);
  });
  it('never places a point after a pan, even when the pointer returns to its start',()=>{
    const gesture=new DrawingGesture();gesture.down(1,0,100,100);gesture.move(1,160,100);gesture.move(1,100,100);gesture.up(1,0,100,100);
    expect(gesture.consume(0)).toBe(false);
    gesture.down(1,0,100,100);gesture.up(1,0,120,100);expect(gesture.consume(0)).toBe(false);
  });
  it('rejects right and middle button navigation while allowing the next deliberate click',()=>{
    for(const button of [1,2]){const gesture=new DrawingGesture();gesture.down(1,button,100,100);gesture.up(1,button,100,100);expect(gesture.consume(button)).toBe(false);
      gesture.down(1,0,100,100);gesture.up(1,0,100,100);expect(gesture.consume(0)).toBe(true);}
  });
  it('suppresses pinch and wheel gestures without blocking subsequent point clicks',()=>{
    const gesture=new DrawingGesture();gesture.down(1,0,100,100);gesture.down(2,0,130,130);gesture.up(1,0,100,100);gesture.up(2,0,130,130);
    expect(gesture.consume(0)).toBe(false);
    gesture.down(1,0,100,100);gesture.wheel();gesture.up(1,0,100,100);expect(gesture.consume(0)).toBe(false);
    gesture.down(1,0,100,100);gesture.up(1,0,100,100);expect(gesture.consume(0)).toBe(true);
  });
  it('discards cancelled gestures but allows the normal pointer-capture release after a click',()=>{
    const gesture=new DrawingGesture();gesture.down(1,0,100,100);gesture.cancel(1);gesture.up(1,0,100,100);expect(gesture.consume(0)).toBe(false);
    gesture.down(1,0,100,100);gesture.up(1,0,100,100);gesture.cancel(1);expect(gesture.consume(0)).toBe(true);
    gesture.down(1,0,100,100);gesture.cancel();expect(gesture.consume(0)).toBe(false);
  });
});
