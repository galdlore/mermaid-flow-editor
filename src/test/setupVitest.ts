import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { preloadLocaleCatalog } from '../i18n';
import { enCatalog } from '../locales/en';
import { jaCatalog } from '../locales/ja';

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('mermaid-flow-editor:lang', 'ja');
  preloadLocaleCatalog('ja', jaCatalog);
  preloadLocaleCatalog('en', enCatalog);
});

afterEach(() => {
  cleanup();
});
