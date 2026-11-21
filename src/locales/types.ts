import type {
  CoreTranslationCatalog,
  InspectorCoreTranslations,
} from './types/core';
import type { ModelingDiagramInspectorTranslations } from './types/diagramsModeling';
import type { PlanningDiagramInspectorTranslations } from './types/diagramsPlanning';
import type { StrategyDiagramInspectorTranslations } from './types/diagramsStrategy';
import type { SystemsDiagramInspectorTranslations } from './types/diagramsSystems';

export * from './types/core';
export type * from './types/diagramsPlanning';
export type * from './types/diagramsModeling';
export type * from './types/diagramsStrategy';
export type * from './types/diagramsSystems';

export interface TranslationCatalog extends CoreTranslationCatalog {
  inspector: InspectorCoreTranslations &
    PlanningDiagramInspectorTranslations &
    ModelingDiagramInspectorTranslations &
    StrategyDiagramInspectorTranslations &
    SystemsDiagramInspectorTranslations;
}
