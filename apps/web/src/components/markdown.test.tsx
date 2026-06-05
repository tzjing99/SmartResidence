import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './markdown';

const SAMPLE = `## Notice from JMB
The water utility will be performing pipe maintenance on **June 12, 2026** from **10am to 2pm**. Please store water in advance.`;

describe('Markdown', () => {
  it('renders **bold** as <strong>', () => {
    const html = renderToStaticMarkup(<Markdown>{'Store **water** now'}</Markdown>);
    expect(html).toContain('<strong');
    expect(html).toContain('water</strong>');
  });

  it('renders the sample JMB notice as a heading + bold dates (not raw markdown)', () => {
    const html = renderToStaticMarkup(<Markdown>{SAMPLE}</Markdown>);
    expect(html).toContain('<h2');
    expect(html).toContain('Notice from JMB</h2>');
    expect(html).toContain('<strong');
    expect(html).toContain('June 12, 2026</strong>');
    // The raw markdown tokens must not survive to the output.
    expect(html).not.toContain('## Notice');
    expect(html).not.toContain('**June 12, 2026**');
  });

  it('sanitizes raw HTML / script injection', () => {
    const html = renderToStaticMarkup(
      <Markdown>{'<script>alert(1)</script><img src=x onerror="alert(1)">'}</Markdown>,
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});
