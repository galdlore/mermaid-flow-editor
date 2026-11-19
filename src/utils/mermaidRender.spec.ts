import { describe, expect, it } from 'vitest';
import { sanitizeRenderedSvg } from './mermaidRender';

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
