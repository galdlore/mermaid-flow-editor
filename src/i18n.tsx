import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Language, TranslationCatalog } from './locales/types';
import { parseEmbedConfig } from './utils/embedBridge';
import { readLocalStorage, writeLocalStorage } from './utils/storage';

export type { Language, TranslationCatalog } from './locales/types';
export {
  APP_VERSION,
  INITIAL_MARKDOWN_JA,
  INITIAL_MARKDOWN_EN,
  getInitialMarkdownByLang,
} from './locales/templates';

export const LANG_STORAGE_KEY = 'mermaid-flow-editor:lang';

const catalogCache: Partial<Record<Language, TranslationCatalog>> = {};
const pendingCatalogLoads: Partial<Record<Language, Promise<TranslationCatalog>>> = {};

export function preloadLocaleCatalog(lang: Language, catalog: TranslationCatalog): void {
  catalogCache[lang] = catalog;
}

export function clearLocaleCatalogCache(): void {
  delete catalogCache.ja;
  delete catalogCache.en;
  delete pendingCatalogLoads.ja;
  delete pendingCatalogLoads.en;
}

export async function loadLocaleCatalog(lang: Language): Promise<TranslationCatalog> {
  const cached = catalogCache[lang];
  if (cached) {
    return cached;
  }
  const existingPending = pendingCatalogLoads[lang];
  if (existingPending) {
    return existingPending;
  }

  const pending = (
    lang === 'ja'
      ? import('./locales/ja').then((mod) => mod.jaCatalog)
      : import('./locales/en').then((mod) => mod.enCatalog)
  )
    .then((catalog) => {
      catalogCache[lang] = catalog;
      return catalog;
    })
    .finally(() => {
      delete pendingCatalogLoads[lang];
    });

  pendingCatalogLoads[lang] = pending;
  return pending;
}

export function detectInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    const embedConfig = parseEmbedConfig(window.location?.search ?? '');
    if (embedConfig.enabled && embedConfig.initialLang) {
      return embedConfig.initialLang;
    }
  }

  const saved = readLocalStorage(LANG_STORAGE_KEY);
  if (saved === 'ja' || saved === 'en') {
    return saved;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  return 'en';
}

export interface I18nContextValue {
  lang: Language;
  setLang: (nextLang: Language) => void;
  toggleLang: () => void;
  t: TranslationCatalog;
}

export interface I18nProviderProps {
  children: ReactNode;
  initialLang?: Language;
  initialCatalog?: TranslationCatalog;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLang,
  initialCatalog,
}: I18nProviderProps) {
  const startLangRef = useRef<Language>(initialLang ?? detectInitialLanguage());
  const startLang = startLangRef.current;

  if (initialCatalog && !catalogCache[startLang]) {
    catalogCache[startLang] = initialCatalog;
  }

  const [state, setState] = useState<{
    lang: Language;
    catalog: TranslationCatalog | null;
  }>(() => ({
    lang: startLang,
    catalog: initialCatalog ?? catalogCache[startLang] ?? null,
  }));

  const targetLangRef = useRef<Language>(startLang);
  const requestIdRef = useRef(0);

  const isEmbedMode = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return parseEmbedConfig(window.location?.search ?? '').enabled;
  }, []);

  useEffect(() => {
    if (state.catalog !== null) {
      return;
    }
    let cancelled = false;
    const reqId = requestIdRef.current;
    const langToLoad = targetLangRef.current;
    void loadLocaleCatalog(langToLoad).then((loaded) => {
      if (cancelled || requestIdRef.current !== reqId) {
        return;
      }
      setState({ lang: langToLoad, catalog: loaded });
    });
    return () => {
      cancelled = true;
    };
  }, [state.catalog]);

  useEffect(() => {
    if (!state.catalog) {
      return;
    }
    document.documentElement.lang = state.lang;
    if (!isEmbedMode) {
      writeLocalStorage(LANG_STORAGE_KEY, state.lang);
    }
  }, [isEmbedMode, state.catalog, state.lang]);

  const setLang = useCallback((nextLang: Language) => {
    targetLangRef.current = nextLang;
    const reqId = ++requestIdRef.current;
    const cached = catalogCache[nextLang];
    if (cached) {
      setState({ lang: nextLang, catalog: cached });
      return;
    }
    void loadLocaleCatalog(nextLang).then((loaded) => {
      if (requestIdRef.current !== reqId) {
        return;
      }
      setState({ lang: nextLang, catalog: loaded });
    });
  }, []);

  const toggleLang = useCallback(() => {
    const nextLang: Language = targetLangRef.current === 'ja' ? 'en' : 'ja';
    setLang(nextLang);
  }, [setLang]);

  const value = useMemo<I18nContextValue | null>(
    () =>
      state.catalog
        ? {
            lang: state.lang,
            setLang,
            toggleLang,
            t: state.catalog,
          }
        : null,
    [state.catalog, state.lang, setLang, toggleLang]
  );

  if (!value) {
    return null;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
