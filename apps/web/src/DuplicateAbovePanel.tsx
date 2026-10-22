import { ArrowUp } from 'lucide-react';
import { Button, Card, CardContent, FieldMessage, NumberField, Row } from './ui';

export function DuplicateAbovePanel({ spacing, busy, preview, movesRoof, error, valid, onSpacing, onDuplicate, onFinish }: {
  spacing: number; busy: boolean; preview: boolean; movesRoof: boolean; error?: string | null; valid: boolean;
  onSpacing: (value: number) => void; onDuplicate: () => void; onFinish: () => void;
}) {
  return <Card size="compact" className="shadow-lg" role="group" aria-label="Duplicate floor above">
    <CardContent>
    <form onSubmit={event => { event.preventDefault(); if (!busy && (!preview || valid)) onDuplicate(); }}>
    <NumberField label="Copy floor spacing" value={spacing} min={0.5} max={30} step={0.1} unit="m" disabled={busy} onChange={onSpacing} />
    {preview && movesRoof && <FieldMessage>The top roof moves up with the copy.</FieldMessage>}
    {error && <FieldMessage tone="error" role="alert">{error}</FieldMessage>}
    <Row className="mt-2">
    <Button type="submit" size="sm" className="flex-1" disabled={busy || (preview && !valid)}><ArrowUp size={15} />{preview ? 'Place copy above' : 'Duplicate above'}</Button>
    {preview && <Button variant="ghost" size="sm" onClick={onFinish} title="Finish copying (Esc)">Done</Button>}
    </Row>
    </form>
    </CardContent>
  </Card>;
}
