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
import {
  ALL_INSPECTOR_LOCALE_GROUPS,
  type CoreTranslationCatalog,
  type InspectorLocaleGroup,
  type Language,
  type TranslationCatalog,
} from './locales/types';
import { parseEmbedConfig } from './utils/embedBridge';
import { readLocalStorage, writeLocalStorage } from './utils/storage';

export type { InspectorLocaleGroup, Language, TranslationCatalog } from './locales/types';
export {
  APP_VERSION,
  INITIAL_MARKDOWN_JA,
  INITIAL_MARKDOWN_EN,
  getInitialMarkdownByLang,
} from './locales/templates';

export const LANG_STORAGE_KEY = 'mermaid-flow-editor:lang';

const coreCache: Partial<Record<Language, CoreTranslationCatalog>> = {};
const inspectorCache: Record<Language, Partial<TranslationCatalog['inspector']>> = {
  ja: {},
  en: {},
};
const loadedGroups: Record<Language, Set<InspectorLocaleGroup>> = {
  ja: new Set(),
  en: new Set(),
};
const catalogCache: Partial<Record<Language, TranslationCatalog>> = {};
const pendingCoreLoads: Partial<Record<Language, Promise<CoreTranslationCatalog>>> = {};
const pendingGroupLoads: Record<Language, Partial<Record<InspectorLocaleGroup, Promise<void>>>> = {
  ja: {},
  en: {},
};

function rebuildCatalog(lang: Language): TranslationCatalog {
  const core = coreCache[lang];
  if (!core) {
    throw new Error(`Core locale catalog not loaded for "${lang}"`);
  }
  const assembled: TranslationCatalog = {
    ...core,
    inspector: {
      ...inspectorCache[lang],
    } as TranslationCatalog['inspector'],
  };
  catalogCache[lang] = assembled;
  return assembled;
}

export function preloadLocaleCatalog(lang: Language, catalog: TranslationCatalog): void {
  coreCache[lang] = catalog;
  inspectorCache[lang] = { ...catalog.inspector };
  loadedGroups[lang] = new Set(ALL_INSPECTOR_LOCALE_GROUPS);
  catalogCache[lang] = catalog;
}

export function clearLocaleCatalogCache(): void {
  delete coreCache.ja;
  delete coreCache.en;
  inspectorCache.ja = {};
  inspectorCache.en = {};
  loadedGroups.ja.clear();
  loadedGroups.en.clear();
  delete catalogCache.ja;
  delete catalogCache.en;
  delete pendingCoreLoads.ja;
  delete pendingCoreLoads.en;
  pendingGroupLoads.ja = {};
  pendingGroupLoads.en = {};
}

export function hasLoadedInspectorLocaleGroups(
  lang: Language,
  groups: ReadonlyArray<InspectorLocaleGroup>
): boolean {
  return Boolean(coreCache[lang]) && groups.every((group) => loadedGroups[lang].has(group));
}

async function loadCoreCatalog(lang: Language): Promise<CoreTranslationCatalog> {
  const cached = coreCache[lang];
  if (cached) {
    return cached;
  }
  const existingPending = pendingCoreLoads[lang];
  if (existingPending) {
    return existingPending;
  }

  const pending = (
    lang === 'ja'
      ? import('./locales/ja/core').then((mod) => mod.jaCoreCatalog)
      : import('./locales/en/core').then((mod) => mod.enCoreCatalog)
  )
    .then((core) => {
      coreCache[lang] = core;
      return core;
    })
    .finally(() => {
      delete pendingCoreLoads[lang];
    });

  pendingCoreLoads[lang] = pending;
  return pending;
}

async function importInspectorGroupSlice(
  lang: Language,
  group: InspectorLocaleGroup
): Promise<Partial<TranslationCatalog['inspector']>> {
  switch (group) {
    case 'core':
      return lang === 'ja'
        ? import('./locales/ja/inspectorCore').then((mod) => mod.jaInspectorCore)
        : import('./locales/en/inspectorCore').then((mod) => mod.enInspectorCore);
    case 'planning':
      return lang === 'ja'
        ? import('./locales/ja/planning').then((mod) => mod.jaPlanningInspector)
        : import('./locales/en/planning').then((mod) => mod.enPlanningInspector);
    case 'charts':
      return lang === 'ja'
        ? import('./locales/ja/charts').then((mod) => mod.jaChartsInspector)
        : import('./locales/en/charts').then((mod) => mod.enChartsInspector);
    case 'architectureMindmap':
      return lang === 'ja'
        ? import('./locales/ja/architectureMindmap').then((mod) => mod.jaArchitectureMindmapInspector)
        : import('./locales/en/architectureMindmap').then((mod) => mod.enArchitectureMindmapInspector);
    case 'uml':
      return lang === 'ja'
        ? import('./locales/ja/uml').then((mod) => mod.jaUmlInspector)
        : import('./locales/en/uml').then((mod) => mod.enUmlInspector);
    case 'extra':
      return lang === 'ja'
        ? import('./locales/ja/extra').then((mod) => mod.jaExtraInspector)
        : import('./locales/en/extra').then((mod) => mod.enExtraInspector);
    case 'strategy':
      return lang === 'ja'
        ? import('./locales/ja/strategy').then((mod) => mod.jaStrategyInspector)
        : import('./locales/en/strategy').then((mod) => mod.enStrategyInspector);
    case 'systems':
      return lang === 'ja'
        ? import('./locales/ja/systems').then((mod) => mod.jaSystemsInspector)
        : import('./locales/en/systems').then((mod) => mod.enSystemsInspector);
  }
}

async function loadSingleInspectorGroup(
  lang: Language,
  group: InspectorLocaleGroup
): Promise<void> {
  if (loadedGroups[lang].has(group)) {
    return;
  }
  const existingPending = pendingGroupLoads[lang][group];
  if (existingPending) {
    return existingPending;
  }

  const pending = importInspectorGroupSlice(lang, group)
    .then((slice) => {
      Object.assign(inspectorCache[lang], slice);
      loadedGroups[lang].add(group);
    })
    .finally(() => {
      delete pendingGroupLoads[lang][group];
    });

  pendingGroupLoads[lang][group] = pending;
  return pending;
}

export async function loadInspectorLocaleGroups(
  lang: Language,
  groups: ReadonlyArray<InspectorLocaleGroup>
): Promise<TranslationCatalog> {
  const uniqueGroups = Array.from(new Set(groups));
  if (hasLoadedInspectorLocaleGroups(lang, uniqueGroups) && catalogCache[lang]) {
    return catalogCache[lang]!;
  }

  const missingGroups = uniqueGroups.filter((group) => !loadedGroups[lang].has(group));
  await Promise.all([
    loadCoreCatalog(lang),
    ...missingGroups.map((group) => loadSingleInspectorGroup(lang, group)),
  ]);

  return rebuildCatalog(lang);
}

export async function loadLocaleCatalog(lang: Language): Promise<TranslationCatalog> {
  return loadInspectorLocaleGroups(lang, []);
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
  ensureInspectorLocaleGroups: (
    groups: ReadonlyArray<InspectorLocaleGroup>
  ) => Promise<TranslationCatalog>;
  hasInspectorLocaleGroups: (groups: ReadonlyArray<InspectorLocaleGroup>) => boolean;
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
    preloadLocaleCatalog(startLang, initialCatalog);
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
  const requestedGroupsRef = useRef<Set<InspectorLocaleGroup>>(new Set());

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
    const requiredGroups = Array.from(requestedGroupsRef.current);
    void loadInspectorLocaleGroups(langToLoad, requiredGroups).then((loaded) => {
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
    const requiredGroups = Array.from(requestedGroupsRef.current);
    if (hasLoadedInspectorLocaleGroups(nextLang, requiredGroups) && catalogCache[nextLang]) {
      setState({ lang: nextLang, catalog: catalogCache[nextLang]! });
      return;
    }
    void loadInspectorLocaleGroups(nextLang, requiredGroups).then((loaded) => {
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

  const ensureInspectorLocaleGroups = useCallback(
    async (groups: ReadonlyArray<InspectorLocaleGroup>): Promise<TranslationCatalog> => {
      for (const group of groups) {
        requestedGroupsRef.current.add(group);
      }
      const reqId = requestIdRef.current;
      const langToLoad = targetLangRef.current;
      const loaded = await loadInspectorLocaleGroups(langToLoad, groups);
      if (requestIdRef.current === reqId && targetLangRef.current === langToLoad) {
        setState((prev) =>
          prev.lang === langToLoad && prev.catalog === loaded
            ? prev
            : { lang: langToLoad, catalog: loaded }
        );
      }
      return loaded;
    },
    []
  );

  const hasInspectorLocaleGroups = useCallback(
    (groups: ReadonlyArray<InspectorLocaleGroup>): boolean =>
      hasLoadedInspectorLocaleGroups(state.lang, groups),
    [state.lang, state.catalog]
  );

  const value = useMemo<I18nContextValue | null>(
    () =>
      state.catalog
        ? {
            lang: state.lang,
            setLang,
            toggleLang,
            t: state.catalog,
            ensureInspectorLocaleGroups,
            hasInspectorLocaleGroups,
          }
        : null,
    [
      state.catalog,
      state.lang,
      setLang,
      toggleLang,
      ensureInspectorLocaleGroups,
      hasInspectorLocaleGroups,
    ]
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
