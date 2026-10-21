import { useRef } from 'react';
import { classes } from './classes';

/** A shared divider for panels docked on either side of the viewer. */
export function PanelResizeHandle({ side, width, min = 260, max = 440, defaultWidth, label, controls, onWidthChange }: {
  side: 'left' | 'right'; width: number; min?: number; max?: number; defaultWidth: number;
  label: string; controls: string; onWidthChange: (width: number) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const direction = side === 'left' ? 1 : -1;
  const resize = (next: number) => onWidthChange(Math.max(min, Math.min(max, Math.round(next))));
  return <div role="separator" aria-label={label} aria-controls={controls} aria-orientation="vertical"
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={width} aria-valuetext={`${width} pixels`} tabIndex={0}
    title="Drag to resize · Double-click to reset"
    className={classes('group absolute inset-y-0 z-[6] w-2 cursor-col-resize touch-none select-none outline-none max-[1000px]:hidden hover:bg-accent/10 focus-visible:bg-accent/20', side === 'left' ? '-right-1' : '-left-1')}
    onDoubleClick={() => resize(defaultWidth)}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      resize(event.key === 'Home' ? min : event.key === 'End' ? max : width + (event.key === 'ArrowRight' ? 12 : -12) * direction);
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus();
      drag.current = { x: event.clientX, width };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
        resize(drag.current.width + (event.clientX - drag.current.x) * direction);
      }
    }}
    onPointerUp={event => {
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}
  >
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted/50 group-hover:bg-accent group-focus-visible:bg-accent" />
  </div>;
}
