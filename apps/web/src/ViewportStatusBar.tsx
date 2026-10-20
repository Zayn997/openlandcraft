import { CircleHelp, Pause, Play } from 'lucide-react';
import { Button, Row, SelectInput, SelectOption } from './ui';

export function ViewportStatusBar({ saveStatus, fps, hasWater, playing, onPlaying, quality, onQuality, onHelp }: {
  saveStatus: string; fps?: number; hasWater: boolean; playing: boolean; onPlaying: () => void;
  quality: 'high' | 'low'; onQuality: (value: 'high' | 'low') => void; onHelp: () => void;
}) {
  return <footer className="flex shrink-0 items-center gap-2 min-h-10 compact:min-h-11 px-2 border-0 border-t border-solid border-[var(--ui-toolbar-line)] bg-[var(--ui-toolbar-surface)] text-[var(--ui-toolbar-ink)] text-label" aria-label="Viewport status">
    <span className="min-w-0 flex-1 truncate" title={saveStatus} role="status">{saveStatus}</span>
    <span className="phone:hidden shrink-0" title="Renderer performance · WebGL 2 · 1 unit = 1 meter">{fps === undefined ? 'Starting…' : `${fps} FPS`}</span>
    <Row gap="none" className="shrink-0">
      {hasWater && <Button variant="toolbar" size="icon" aria-label={playing ? 'Pause water animation' : 'Play water animation'} title={playing ? 'Pause water animation' : 'Play water animation'} onClick={onPlaying}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </Button>}
      <SelectInput appearance="toolbar" side="top" aria-label="Preview quality" value={quality} onValueChange={value => onQuality(value as 'high' | 'low')}>
        <SelectOption value="high">High quality</SelectOption><SelectOption value="low">Low quality</SelectOption>
      </SelectInput>
      <Button variant="toolbar" size="icon" aria-label="Show editor help" title="Navigation and shortcuts · Drag to orbit · Right-drag to pan · Scroll to zoom · Units: meters" onClick={onHelp}><CircleHelp size={15} /></Button>
    </Row>
  </footer>;
}
