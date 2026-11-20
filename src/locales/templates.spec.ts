import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_VERSION,
  INITIAL_MARKDOWN_EN,
  INITIAL_MARKDOWN_JA,
} from './templates';

describe('Help guide version injection', () => {
  it('embeds package.json version into Japanese and English guide headings', () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8')
    ) as { version: string };

    expect(APP_VERSION).toBe(pkg.version);
    expect(INITIAL_MARKDOWN_JA).toContain(`# Mermaid Flow Editor 使い方ガイド (v${pkg.version})`);
    expect(INITIAL_MARKDOWN_EN).toContain(`# Mermaid Flow Editor Usage Guide (v${pkg.version})`);
  });
});
