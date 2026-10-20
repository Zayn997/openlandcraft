import { Button, Panel, PanelHeader, Row } from './ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronsDownUp, ChevronsUpDown, PanelRightClose, PanelRightOpen, Settings2 } from 'lucide-react';
import { InspectorSectionsProvider, useInspectorSections } from './InspectorSectionsContext';

export function InspectorPanel({ children, scope, selectionKey, mobileActive, editing }: {
  children: ReactNode; scope: string; selectionKey: string; mobileActive: boolean; editing: boolean;
}) {
  const sections = useInspectorSections(scope);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('olc-inspector-collapsed') === 'true'; } catch { return false; }
  });
  const expandButton = useRef<HTMLButtonElement>(null), collapseButton = useRef<HTMLButtonElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo(0, 0); }, [selectionKey, scope]);
  const togglePanel = (next: boolean) => {
    setCollapsed(next);
    try { localStorage.setItem('olc-inspector-collapsed', String(next)); } catch { /* Optional preference. */ }
    requestAnimationFrame(() => (next ? expandButton : collapseButton).current?.focus());
  };
  return <Panel as="aside" id="inspector" aria-label="Object inspector"
    className={`inspector inspector-dock ${mobileActive ? 'mobile-active' : ''} ${collapsed ? 'inspector-collapsed' : ''}`}>
    <div className="inspector-rail">
      <Button variant="ghost" size="icon" ref={expandButton} className="icon-button" aria-label="Expand properties panel" title="Expand properties panel" onClick={() => togglePanel(false)}><PanelRightOpen size={17} /></Button>
      <Settings2 size={16} aria-hidden="true" /><span>Properties</span>
    </div>
    <div className="inspector-expanded">
      <PanelHeader>
        <Row gap="xs"><Settings2 size={15} aria-hidden="true" /><strong>Properties</strong>{editing && <span className="inspector-preview-dot" title="Changes in preview" />}</Row>
        <Row gap="none">
          <Button variant="ghost" size="icon" className="icon-button" title="Expand all sections" aria-label="Expand all property sections" onClick={() => sections.setAll(true)}><ChevronsUpDown size={15} /></Button>
          <Button variant="ghost" size="icon" className="icon-button" title="Collapse all sections" aria-label="Collapse all property sections" onClick={() => sections.setAll(false)}><ChevronsDownUp size={15} /></Button>
          <Button variant="ghost" size="icon" ref={collapseButton} className="icon-button inspector-collapse-button max-[1000px]:hidden" title="Collapse properties panel" aria-label="Collapse properties panel" onClick={() => togglePanel(true)}><PanelRightClose size={16} /></Button>
        </Row>
      </PanelHeader>
      <div className="inspector-scroll" ref={scroll}><InspectorSectionsProvider value={sections.value}>{children}</InspectorSectionsProvider></div>
    </div>
  </Panel>;
}
