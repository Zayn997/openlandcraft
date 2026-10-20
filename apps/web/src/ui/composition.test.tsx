import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';
import { cn } from './cn';

describe('shared component composition', () => {
  it('keeps semantic text colors separate from our custom typography tokens', () => {
    expect(cn('text-ink text-ui', 'text-danger text-label')).toBe('text-danger text-label');
    expect(cn('min-h-control px-panel', 'min-h-10 px-2')).toBe('min-h-10 px-2');
  });

  it('does not accidentally submit inspector forms, but supports explicit submit actions', () => {
    expect(renderToStaticMarkup(<Button>Duplicate</Button>)).toContain('type="button"');
    expect(renderToStaticMarkup(<Button type="submit" disabled>Apply</Button>)).toMatch(/type="submit"/);
    expect(renderToStaticMarkup(<Button type="submit" disabled>Apply</Button>)).toContain('disabled=""');
  });

  it('preserves link semantics when composed through a slot', () => {
    const markup = renderToStaticMarkup(<Button asChild><a href="#inspector">Inspect</a></Button>);
    expect(markup).toContain('<a href="#inspector"');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('type="button"');
  });
});
