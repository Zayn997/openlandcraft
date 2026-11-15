import type { ComponentProps, ReactNode } from 'react';
import { Focus } from 'lucide-react';
import { Button, FieldMessage, Panel, Row } from './ui';
import { InspectorSection } from './InspectorSection';

type PropertiesPanelProps = Omit<ComponentProps<'section'>, 'title'> & {
  title: ReactNode;
  description?: ReactNode;
  onFrame?: () => void;
  actions?: ReactNode;
  status?: string;
};

/** Shared shell for every selected element: compact heading, fields, then secondary actions. */
export function PropertiesPanel({ title, description, onFrame, actions, status, children, className='', ...props }: PropertiesPanelProps) {
  return <Panel {...props} padding="body" className={`properties-panel ${className}`}>
    <Row justify="between" className="properties-heading">
      <h2>{title}</h2>
      {onFrame && <Button variant="ghost" size="icon" aria-label="Frame selected element" title="Frame selected element · F" onClick={onFrame}><Focus size={16}/></Button>}
    </Row>
    {description && <FieldMessage className="properties-description">{description}</FieldMessage>}
    {children}
    {actions && <InspectorSection sectionId="properties-actions" title="Actions" defaultOpen={false}><div className="properties-actions">{actions}</div></InspectorSection>}
    {status && <FieldMessage role="status">{status}</FieldMessage>}
  </Panel>;
}

/** Form variant keeps submit/cancel handlers intact without nesting forms. */
export function PropertiesForm({title,description,onFrame,actions,status,className,children,...form}:Omit<ComponentProps<'form'>,'title'> & Pick<PropertiesPanelProps,'title'|'description'|'onFrame'|'actions'|'status'>) {
  return <PropertiesPanel title={title} description={description} onFrame={onFrame} actions={actions} status={status} className={className}>
    <form {...form}>{children}</form>
  </PropertiesPanel>;
}
