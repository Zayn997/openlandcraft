import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyCommand, createSite, Editor, type Block } from '@openlandcraft/core';
import { MirrorPanel } from './MirrorTools';

const noop = () => {};
const block: Block = { id: 'source', name: 'Selected hedge block', parentId: 'site', kind: 'block', visible: true, position: [-8, 2, 3], rotation: 0, size: [2, 3, 4], color: '#668844' };
const fixture = () => new Editor(applyCommand(createSite({ name: 'Mirror UI', width: 80, depth: 80, resolution: 129, preset: 'flat' }), { type: 'add', entity: block }));

describe('mirror setup panel', () => {
  it('opens with the explicit source and two axis methods, with no default mirror preview', () => {
    const editor = fixture(); editor.select(block.id);
    const markup = renderToStaticMarkup(<MirrorPanel editor={editor} request={{sourceIds:[block.id]}} onClose={noop} onSelect={noop} onGuide={noop} onInput={noop} onReferenceGuide={noop}/>);
    expect(markup).toContain('Selected hedge block'); expect(markup).toContain('Draw mirror line'); expect(markup).toContain('Use scene line');
    expect(markup).not.toContain('Mirror source'); expect(markup).not.toContain('Axis X = 0');
    expect(markup).toMatch(/disabled=""[^>]*>Apply symmetry/);
    expect(editor.getSnapshot().preview).toBeNull(); expect(editor.getSnapshot().gestureLabel).toBeNull();
  });
  it('does not silently choose an existing object when the selection is empty', () => {
    const editor = fixture();
    const markup = renderToStaticMarkup(<MirrorPanel editor={editor} request={{sourceIds:[]}} onClose={noop} onSelect={noop} onGuide={noop} onInput={noop} onReferenceGuide={noop}/>);
    expect(markup).toContain('Selected sources (0)'); expect(markup).not.toContain('Selected hedge block');
    expect(markup).toContain('Select at least one'); expect(editor.getSnapshot().preview).toBeNull();
  });
});
