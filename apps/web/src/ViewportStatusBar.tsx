import { CircleHelp, Pause, Play, X } from 'lucide-react';
import { Button, Row, SelectInput, SelectOption } from './ui';
import {FrameRate,type ViewportMetricsSource} from './viewport-metrics';

export function ViewportStatusBar({ saveStatus, fps, metricsSource, hasAnimation, playing, onPlaying, quality, onQuality, onHelp, placement }: {
  saveStatus: string; fps?: number; hasAnimation: boolean; playing: boolean; onPlaying: () => void;
  metricsSource?:ViewportMetricsSource;
  quality: 'high' | 'low'; onQuality: (value: 'high' | 'low') => void; onHelp: () => void;
  placement?: { name: string; loading: boolean; painting?: boolean; bird?: boolean; fish?: boolean; onCancel: () => void };
}) {
  return <footer className="flex shrink-0 items-center gap-2 min-h-10 compact:min-h-11 px-2 border-0 border-t border-solid border-[var(--ui-toolbar-line)] bg-[var(--ui-toolbar-surface)] text-[var(--ui-toolbar-ink)] text-label" aria-label="Viewport status">
    <span className="min-w-0 flex-1 truncate" title={placement ? (placement.fish ? 'Click deeper, open water to set a swim center. Escape finishes placement.' : placement.bird ? 'Click the ground to set a flight center. Escape finishes placement.' : placement.painting ? 'Drag to paint plants. Escape cancels the active stroke.' : 'Click the ground to place the asset. Escape finishes placement.') : saveStatus} role="status">{placement ? placement.loading ? `Loading ${placement.name}…` : `${placement.name} · ${placement.fish ? 'Set swim center' : placement.bird ? 'Set flight center' : placement.painting ? 'Drag to paint' : 'Click ground'}` : saveStatus}</span>
    {placement && <Button variant="toolbar" size="icon" aria-label="Finish placement" title="Finish placement (Escape)" onClick={placement.onCancel}><X size={14} /></Button>}
    <span className="phone:hidden shrink-0" title="Renderer performance · WebGL 2 · 1 unit = 1 meter">{metricsSource?<FrameRate source={metricsSource}/>:fps === undefined ? 'Starting…' : `${fps} FPS`}</span>
    <Row gap="none" className="shrink-0">
      {hasAnimation && <Button variant="toolbar" size="icon" aria-label={playing ? 'Pause scene animation' : 'Play scene animation'} title={playing ? 'Pause scene animation' : 'Play scene animation'} onClick={onPlaying}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </Button>}
      <SelectInput appearance="toolbar" side="top" aria-label="Preview quality" value={quality} onValueChange={value => onQuality(value as 'high' | 'low')}>
        <SelectOption value="high">High quality</SelectOption><SelectOption value="low">Low quality</SelectOption>
      </SelectInput>
      <Button variant="toolbar" size="icon" aria-label="Show editor help" title="Help, About / Credits, and shortcuts · Drag to orbit · Right-drag to pan · Scroll to zoom · Units: meters" onClick={onHelp}><CircleHelp size={15} /></Button>
    </Row>
  </footer>;
}
