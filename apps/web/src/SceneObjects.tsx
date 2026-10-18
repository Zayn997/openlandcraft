import { memo } from 'react';
import { Box, Eye, EyeOff, Layers, Waves } from 'lucide-react';
import type { Editor, Entity } from '@openlandcraft/core';

const SceneRow = memo(function SceneRow({ entity, selected, editor, onSelect, guard }: {
  entity: Entity; selected: boolean; editor: Editor; onSelect: (id: string) => void; guard: (run: () => void) => void;
}) {
  return <div className={`tree-row ${selected ? 'selected' : ''}`} role="listitem"><button className={`tree-select ${entity.parentId !== 'site' ? 'child-row' : ''}`} aria-pressed={selected} onClick={() => onSelect(entity.id)}><span className="tree-guide" />{entity.kind === 'ocean' || entity.kind === 'river' ? <Waves size={16} /> : entity.kind === 'level' ? <Layers size={15} /> : <Box size={15} />}<span>{entity.name}</span></button>
    <button className="icon-button" type="button" aria-label={`${entity.visible ? 'Hide' : 'Show'} ${entity.name}`} title={`${entity.visible ? 'Hide' : 'Show'} ${entity.name}`} onClick={() => guard(() => { editor.cancel(); const current = editor.getSnapshot().project.entities.find((value) => value.id === entity.id)!; editor.execute({ type: 'replace', entity: { ...current, visible: !current.visible } }, `Toggle ${current.name}`); })}>{entity.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button></div>;
});
export const SceneObjects = memo(function SceneObjects({ entities, selectedId, editor, onSelect, guard }: {
  entities: Entity[]; selectedId: string | null; editor: Editor; onSelect: (id: string) => void; guard: (run: () => void) => void;
}) { return <>{entities.map((entity) => <SceneRow key={entity.id} entity={entity} selected={entity.id === selectedId} editor={editor} onSelect={onSelect} guard={guard} />)}</>; });
