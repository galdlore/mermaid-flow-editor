import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, clearLocaleCatalogCache, useI18n } from './i18n';

function LocaleProbe() {
  const { lang, setLang, toggleLang, t } = useI18n();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="file-label">{t.toolbar.fileMenuLabel}</span>
      <span data-testid="lang-btn">{t.toolbar.langButtonLabel}</span>
      <button type="button" onClick={toggleLang}>
        toggle
      </button>
      <button type="button" onClick={() => setLang('en')}>
        set-en
      </button>
    </div>
  );
}

describe('I18nProvider dynamic locale loading', () => {
  beforeEach(() => {
    clearLocaleCatalogCache();
  });

  it('loads the initial locale catalog asynchronously when cache is cold', async () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>
    );

    expect(await screen.findByTestId('lang')).toHaveTextContent('ja');
    expect(screen.getByTestId('file-label')).toHaveTextContent('ファイル');
  });

  it('dynamically loads target locale catalog on toggleLang/setLang and updates lang and t atomically', async () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>
    );

    await screen.findByTestId('lang');
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    await waitFor(() => {
      expect(screen.getByTestId('lang')).toHaveTextContent('en');
    });
    expect(screen.getByTestId('file-label')).toHaveTextContent('File');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('mermaid-flow-editor:lang')).toBe('en');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => {
      expect(screen.getByTestId('lang')).toHaveTextContent('ja');
    });
    expect(screen.getByTestId('file-label')).toHaveTextContent('ファイル');
  });
});
