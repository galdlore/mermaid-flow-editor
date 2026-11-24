import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  I18nProvider,
  clearLocaleCatalogCache,
  hasLoadedInspectorLocaleGroups,
  useI18n,
} from './i18n';

function LocaleProbe() {
  const {
    lang,
    setLang,
    toggleLang,
    t,
    ensureInspectorLocaleGroups,
    hasInspectorLocaleGroups,
  } = useI18n();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="file-label">{t.toolbar.fileMenuLabel}</span>
      <span data-testid="lang-btn">{t.toolbar.langButtonLabel}</span>
      <span data-testid="has-uml">{String(hasInspectorLocaleGroups(['core', 'uml']))}</span>
      <span data-testid="has-systems">{String(hasInspectorLocaleGroups(['systems']))}</span>
      <span data-testid="has-strategy">{String(hasInspectorLocaleGroups(['strategy']))}</span>
      <span data-testid="seq-section">
        {t.inspector.sequence?.participantsSection ?? 'missing'}
      </span>
      <span data-testid="journey-section">
        {t.inspector.journey?.settingsSection ?? 'missing'}
      </span>
      <button type="button" onClick={toggleLang}>
        toggle
      </button>
      <button type="button" onClick={() => setLang('en')}>
        set-en
      </button>
      <button
        type="button"
        onClick={() => void ensureInspectorLocaleGroups(['core', 'uml'])}
      >
        load-uml
      </button>
      <button
        type="button"
        onClick={() => void ensureInspectorLocaleGroups(['core', 'strategy'])}
      >
        load-strategy
      </button>
    </div>
  );
}

describe('I18nProvider dynamic locale loading', () => {
  beforeEach(() => {
    clearLocaleCatalogCache();
    window.localStorage.clear();
  });

  it('loads only the core locale catalog on cold startup without eager inspector groups', async () => {
    render(
      <I18nProvider initialLang="ja">
        <LocaleProbe />
      </I18nProvider>
    );

    expect(await screen.findByTestId('lang')).toHaveTextContent('ja');
    expect(screen.getByTestId('file-label')).toHaveTextContent('ファイル');
    expect(screen.getByTestId('has-uml')).toHaveTextContent('false');
    expect(screen.getByTestId('has-systems')).toHaveTextContent('false');
    expect(hasLoadedInspectorLocaleGroups('ja', ['uml'])).toBe(false);
    expect(hasLoadedInspectorLocaleGroups('ja', ['systems'])).toBe(false);
  });

  it('loads requested inspector locale groups on demand while keeping unrelated groups unloaded', async () => {
    render(
      <I18nProvider initialLang="ja">
        <LocaleProbe />
      </I18nProvider>
    );

    await screen.findByTestId('lang');
    fireEvent.click(screen.getByRole('button', { name: 'load-uml' }));

    await waitFor(() => {
      expect(screen.getByTestId('has-uml')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('seq-section')).not.toHaveTextContent('missing');
    expect(screen.getByTestId('has-systems')).toHaveTextContent('false');
    expect(hasLoadedInspectorLocaleGroups('ja', ['systems'])).toBe(false);
  });

  it('dynamically loads core and requested inspector groups atomically on toggleLang/setLang', async () => {
    render(
      <I18nProvider initialLang="ja">
        <LocaleProbe />
      </I18nProvider>
    );

    await screen.findByTestId('lang');
    fireEvent.click(screen.getByRole('button', { name: 'load-strategy' }));
    await waitFor(() => {
      expect(screen.getByTestId('has-strategy')).toHaveTextContent('true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    await waitFor(() => {
      expect(screen.getByTestId('lang')).toHaveTextContent('en');
    });
    expect(screen.getByTestId('file-label')).toHaveTextContent('File');
    expect(screen.getByTestId('has-strategy')).toHaveTextContent('true');
    expect(screen.getByTestId('journey-section')).not.toHaveTextContent('missing');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('mermaid-flow-editor:lang')).toBe('en');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => {
      expect(screen.getByTestId('lang')).toHaveTextContent('ja');
    });
    expect(screen.getByTestId('file-label')).toHaveTextContent('ファイル');
  });
});
