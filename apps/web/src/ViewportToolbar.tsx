import type { CameraView, TransformMode } from '@openlandcraft/viewport';
import { Button, CheckboxInput, Field, Row, SelectInput, SelectOption } from './ui';

export type { CameraView } from '@openlandcraft/viewport';

export function ViewportToolbar({ view, canShore, canDive, onView, transform, canScale, onTransform, snapping, onSnapping }: {
  view: CameraView; canShore: boolean; canDive: boolean; onView: (view: CameraView) => void;
  transform?: TransformMode; canScale: boolean; onTransform: (mode: TransformMode) => void;
  snapping: boolean; onSnapping: (value: boolean) => void;
}) {
  return <Row className="shrink-0 min-h-10 compact:min-h-11 gap-1 px-2 border-0 border-b border-solid border-[var(--ui-toolbar-line)] bg-[var(--ui-toolbar-surface)] text-[var(--ui-toolbar-ink)] overflow-x-auto" aria-label="Viewport controls">
    <SelectInput appearance="toolbar" aria-label="Camera view" value={view} onValueChange={value => onView(value as CameraView)} className="max-w-40 shrink-0">
      <SelectOption value="perspective">Perspective</SelectOption>
      <SelectOption value="top">Top</SelectOption>
      <SelectOption value="front">Front</SelectOption>
      <SelectOption value="back">Back</SelectOption>
      <SelectOption value="left">Left</SelectOption>
      <SelectOption value="right">Right</SelectOption>
      <SelectOption value="bottom">Bottom</SelectOption>
      <SelectOption value="shore" disabled={!canShore}>Shore</SelectOption>
      <SelectOption value="underwater" disabled={!canDive}>Ocean underwater</SelectOption>
      {view === 'river-underwater' && <SelectOption value="river-underwater">River underwater</SelectOption>}
      {view === 'lake-underwater' && <SelectOption value="lake-underwater">Lake underwater</SelectOption>}
    </SelectInput>
    {transform && <Row gap="none" className="ml-auto shrink-0" role="group" aria-label="Transform tools">
      {(['translate', 'rotate', ...(canScale ? ['scale'] : [])] as TransformMode[]).map(mode =>
        <Button key={mode} variant="toolbar" size="sm" className="px-2 compact:min-h-10" aria-pressed={transform === mode} onClick={() => onTransform(mode)}>
          {mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale'}
        </Button>)}
      <Field variant="checkbox" className="ml-2 text-[var(--ui-toolbar-ink)]"><CheckboxInput aria-label="Snap transforms" checked={snapping} onChange={event => onSnapping(event.target.checked)} />Snap</Field>
    </Row>}
  </Row>;
}
