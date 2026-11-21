import { beforeEach, describe, expect, it, vi } from 'vitest';

const { initializeMock, renderMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn(),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    render: renderMock,
  },
}));

import {
  clearMermaidRenderCache,
  renderMermaidSvg,
  sanitizeRenderedSvg,
} from './mermaidRender';

describe('sanitizeRenderedSvg', () => {
  it('strips dangerous tags, event attributes, and unsafe hrefs while keeping safe SVG content', () => {
    const dirtySvg = `
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" viewBox="0 0 100 100">
        <script>alert('xss')</script>
        <iframe src="https://evil.example"></iframe>
        <g onclick="steal()">
          <a href="javascript:alert(2)"><rect width="20" height="20" /></a>
          <a href="data:text/html,xss"><text>bad</text></a>
          <a href="https://mermaid.js.org/"><text>safe external</text></a>
          <a href="#node-1"><text>safe anchor</text></a>
        </g>
      </svg>
    `;

    const cleaned = sanitizeRenderedSvg(dirtySvg);
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleaned, 'image/svg+xml');
    const svg = doc.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.hasAttribute('onload')).toBe(false);
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('iframe')).toBeNull();

    const g = doc.querySelector('g');
    expect(g?.hasAttribute('onclick')).toBe(false);

    const links = Array.from(doc.querySelectorAll('a'));
    expect(links).toHaveLength(4);
    expect(links[0].hasAttribute('href')).toBe(false);
    expect(links[1].hasAttribute('href')).toBe(false);
    expect(links[2].getAttribute('href')).toBe('https://mermaid.js.org/');
    expect(links[3].getAttribute('href')).toBe('#node-1');
  });

  it('returns empty string when input contains no svg element', () => {
    expect(sanitizeRenderedSvg('')).toBe('');
    expect(sanitizeRenderedSvg('<div>not an svg</div>')).toBe('');
  });
});

describe('renderMermaidSvg dynamic loading and error handling', () => {
  beforeEach(() => {
    clearMermaidRenderCache();
    renderMock.mockReset();
  });

  it('initializes mermaid once across concurrent calls, sanitizes SVG output, and caches results', async () => {
    renderMock
      .mockResolvedValueOnce({
        svg: '<svg onload="evil()"><script>bad()</script><text>first</text></svg>',
      })
      .mockResolvedValueOnce({
        svg: '<svg><text>second</text></svg>',
      });

    const [first, second] = await Promise.all([
      renderMermaidSvg('m-1', 'flowchart TD\nA-->B'),
      renderMermaidSvg('m-2', 'flowchart TD\nC-->D'),
    ]);

    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(initializeMock).toHaveBeenCalledWith({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
    });
    expect(first.error).toBeNull();
    expect(first.svg).not.toContain('<script');
    expect(first.svg).not.toContain('onload');
    expect(first.svg).toContain('first');
    expect(second.error).toBeNull();
    expect(second.svg).toContain('second');

    const cached = await renderMermaidSvg('m-1-repeat', 'flowchart TD\nA-->B');
    expect(cached).toEqual(first);
    expect(renderMock).toHaveBeenCalledTimes(2);
  });

  it('returns an error message without throwing when mermaid.render rejects', async () => {
    renderMock.mockRejectedValueOnce(new Error('Syntax error in text'));

    const result = await renderMermaidSvg('m-err', 'invalid syntax');

    expect(result).toEqual({
      svg: '',
      error: 'Syntax error in text',
    });
  });
});
