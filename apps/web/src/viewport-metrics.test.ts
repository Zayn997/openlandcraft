import {describe,expect,it} from 'vitest';
import {createViewportMetricsSource} from './viewport-metrics';
describe('live renderer metrics ownership',()=>{
  it('keeps one stable snapshot until a sample arrives and releases display subscriptions',()=>{
    const source=createViewportMetricsSource();let notifications=0;
    expect(source.getSnapshot()).toBeNull();
    const stop=source.subscribe(()=>notifications++);
    const sample={fps:60,calls:6,triangles:100,renderer:'test'};
    source.publish(sample);expect(source.getSnapshot()).toBe(sample);expect(source.getSnapshot()).toBe(source.getSnapshot());expect(notifications).toBe(1);
    stop();source.publish({...sample,fps:50});expect(notifications).toBe(1);expect(source.getSnapshot()?.fps).toBe(50);
    expect(createViewportMetricsSource().getSnapshot()).toBeNull();
  });
});
