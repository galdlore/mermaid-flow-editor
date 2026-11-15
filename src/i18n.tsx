import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { enCatalog } from './locales/en';
import { jaCatalog } from './locales/ja';
import type { Language, TranslationCatalog } from './locales/types';
import { readLocalStorage, writeLocalStorage } from './utils/storage';

export type { Language, TranslationCatalog } from './locales/types';
export {
  INITIAL_MARKDOWN_JA,
  INITIAL_MARKDOWN_EN,
  getInitialMarkdownByLang,
} from './locales/templates';

export const LANG_STORAGE_KEY = 'mermaid-flow-editor:lang';

export function detectInitialLanguage(): Language {
  const saved = readLocalStorage(LANG_STORAGE_KEY);
  if (saved === 'ja' || saved === 'en') {
    return saved;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  return 'en';
}

const translations: Record<Language, TranslationCatalog> = {
  ja: jaCatalog,
  en: enCatalog,
};

export interface I18nContextValue {
  lang: Language;
  setLang: (nextLang: Language) => void;
  toggleLang: () => void;
  t: TranslationCatalog;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    writeLocalStorage(LANG_STORAGE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((nextLang: Language) => {
    setLangState(nextLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'ja' ? 'en' : 'ja'));
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      toggleLang,
      t: translations[lang],
    }),
    [lang, setLang, toggleLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
