import type { TranslationCatalog } from './types';
import { enArchitectureMindmapInspector } from './en/architectureMindmap';
import { enChartsInspector } from './en/charts';
import { enCoreCatalog } from './en/core';
import { enExtraInspector } from './en/extra';
import { enInspectorCore } from './en/inspectorCore';
import { enPlanningInspector } from './en/planning';
import { enStrategyInspector } from './en/strategy';
import { enSystemsInspector } from './en/systems';
import { enUmlInspector } from './en/uml';

export const enCatalog: TranslationCatalog = {
  ...enCoreCatalog,
  inspector: {
    ...enInspectorCore,
    ...enPlanningInspector,
    ...enChartsInspector,
    ...enArchitectureMindmapInspector,
    ...enUmlInspector,
    ...enExtraInspector,
    ...enStrategyInspector,
    ...enSystemsInspector,
  },
};
