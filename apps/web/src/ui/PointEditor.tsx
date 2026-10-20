import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from './Card';

/** A numbered point with actions and coordinate fields. */
export function PointEditor({ title, actions, children }: {
  title: ReactNode; actions: ReactNode; children: ReactNode;
}) {
  return <Card size="compact" className="my-2.5 bg-subtle">
    <CardHeader><CardTitle className="text-label text-accent">{title}</CardTitle><CardAction>{actions}</CardAction></CardHeader>
    <CardContent className="[&>.ui-field-grid]:my-0">{children}</CardContent>
  </Card>;
}
