import { ArrowUp } from 'lucide-react';
import { InspectorSection } from './InspectorSection';
import { Button, FieldMessage, NumberField } from './ui';

export function DuplicateAbovePanel({ spacing, busy, preview, movesRoof, error, valid, onSpacing, onDuplicate, onFinish }: {
  spacing: number; busy: boolean; preview: boolean; movesRoof: boolean; error?: string | null; valid: boolean;
  onSpacing: (value: number) => void; onDuplicate: () => void; onFinish: () => void;
}) {
  return <InspectorSection sectionId="duplicate-above" title="Duplicate above" className="mx-panel">
    <form onSubmit={event => { event.preventDefault(); if (!busy && (!preview || valid)) onDuplicate(); }}>
    <NumberField label="Copy floor spacing" value={spacing} min={0.5} max={30} step={0.1} unit="m" disabled={busy} onChange={onSpacing} />
    {preview && <FieldMessage>Preview above · {movesRoof ? 'top roof moves up' : 'independent copy'}. Each placement is one undo step.</FieldMessage>}
    {error && <FieldMessage tone="error" role="alert">{error}</FieldMessage>}
    <Button type="submit" className="w-full my-2" disabled={busy || (preview && !valid)}><ArrowUp size={15} />{preview ? 'Place copy above' : 'Duplicate above'}</Button>
    {preview && <Button variant="ghost" className="w-full" onClick={onFinish}>Finish / cancel preview · Esc</Button>}
    </form>
  </InspectorSection>;
}
