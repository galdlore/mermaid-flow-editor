import type { TranslationCatalog } from './types';
import { jaArchitectureMindmapInspector } from './ja/architectureMindmap';
import { jaChartsInspector } from './ja/charts';
import { jaCoreCatalog } from './ja/core';
import { jaExtraInspector } from './ja/extra';
import { jaInspectorCore } from './ja/inspectorCore';
import { jaPlanningInspector } from './ja/planning';
import { jaStrategyInspector } from './ja/strategy';
import { jaSystemsInspector } from './ja/systems';
import { jaUmlInspector } from './ja/uml';

export const jaCatalog: TranslationCatalog = {
  ...jaCoreCatalog,
  inspector: {
    ...jaInspectorCore,
    ...jaPlanningInspector,
    ...jaChartsInspector,
    ...jaArchitectureMindmapInspector,
    ...jaUmlInspector,
    ...jaExtraInspector,
    ...jaStrategyInspector,
    ...jaSystemsInspector,
  },
};
