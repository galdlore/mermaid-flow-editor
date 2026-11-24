import type { MermaidDiagramType } from '../types/editor';
import type {
  DiagramRegistryEntry,
  EditableDiagramType,
  ErasedDiagramHandler,
} from './types';

export const DIAGRAM_REGISTRY: ReadonlyArray<DiagramRegistryEntry> = [
  {
    id: 'flowchart',
    storeKey: 'flowchart',
    available: true,
    localeGroups: ['core'],
    getSubtitle: (t) => t.modal.subtitle,
    loader: () => import('./flowchart/index').then((mod) => mod.flowchartHandler),
  },
  {
    id: 'swimlane',
    storeKey: 'flowchart',
    available: true,
    localeGroups: ['core'],
    getSubtitle: (t) => t.modal.subtitleSwimlane,
    loader: () => import('./flowchart/index').then((mod) => mod.swimlaneHandler),
  },
  {
    id: 'treeView',
    storeKey: 'treeView',
    available: true,
    localeGroups: ['core', 'planning'],
    getSubtitle: (t) => t.modal.subtitleTreeView,
    loader: () => import('./treeView/index').then((mod) => mod.default),
  },
  {
    id: 'gantt',
    storeKey: 'gantt',
    available: true,
    localeGroups: ['core', 'planning'],
    getSubtitle: (t) => t.modal.subtitleGantt,
    loader: () => import('./gantt/index').then((mod) => mod.default),
  },
  {
    id: 'kanban',
    storeKey: 'kanban',
    available: true,
    localeGroups: ['core', 'planning'],
    getSubtitle: (t) => t.modal.subtitleKanban,
    loader: () => import('./kanban/index').then((mod) => mod.default),
  },
  {
    id: 'pie',
    storeKey: 'pie',
    available: true,
    localeGroups: ['core', 'charts'],
    getSubtitle: (t) => t.modal.subtitlePie,
    loader: () => import('./pie/index').then((mod) => mod.default),
  },
  {
    id: 'xychart',
    storeKey: 'xychart',
    available: true,
    localeGroups: ['core', 'charts'],
    getSubtitle: (t) => t.modal.subtitleXYChart,
    loader: () => import('./xychart/index').then((mod) => mod.default),
  },
  {
    id: 'architecture',
    storeKey: 'architecture',
    available: true,
    localeGroups: ['core', 'architectureMindmap'],
    getSubtitle: (t) => t.modal.subtitleArchitecture,
    loader: () => import('./architecture/index').then((mod) => mod.default),
  },
  {
    id: 'mindmap',
    storeKey: 'mindmap',
    available: true,
    localeGroups: ['core', 'architectureMindmap'],
    getSubtitle: (t) => t.modal.subtitleMindmap,
    loader: () => import('./mindmap/index').then((mod) => mod.default),
  },
  {
    id: 'quadrantChart',
    storeKey: 'quadrantChart',
    available: true,
    localeGroups: ['core', 'charts'],
    getSubtitle: (t) => t.modal.subtitleQuadrantChart,
    loader: () => import('./quadrantChart/index').then((mod) => mod.default),
  },
  {
    id: 'sequence',
    storeKey: 'sequence',
    available: true,
    localeGroups: ['core', 'uml'],
    getSubtitle: (t) => t.modal.subtitleSequence,
    loader: () => import('./sequence/index').then((mod) => mod.default),
  },
  {
    id: 'class',
    storeKey: 'class',
    available: true,
    localeGroups: ['core', 'uml'],
    getSubtitle: (t) => t.modal.subtitleClass,
    loader: () => import('./class/index').then((mod) => mod.default),
  },
  {
    id: 'state',
    storeKey: 'state',
    available: true,
    localeGroups: ['core', 'uml'],
    getSubtitle: (t) => t.modal.subtitleState,
    loader: () => import('./state/index').then((mod) => mod.default),
  },
  {
    id: 'c4',
    storeKey: 'c4',
    available: true,
    localeGroups: ['core', 'uml'],
    getSubtitle: (t) => t.modal.subtitleC4,
    loader: () => import('./c4/index').then((mod) => mod.default),
  },
  {
    id: 'er',
    storeKey: 'er',
    available: true,
    localeGroups: ['core', 'uml'],
    getSubtitle: (t) => t.modal.subtitleEr,
    loader: () => import('./er/index').then((mod) => mod.default),
  },
  {
    id: 'gitGraph',
    storeKey: 'gitGraph',
    available: true,
    localeGroups: ['core', 'extra'],
    getSubtitle: (t) => t.modal.subtitleGitGraph,
    loader: () => import('./gitGraph/index').then((mod) => mod.default),
  },
  {
    id: 'timeline',
    storeKey: 'timeline',
    available: true,
    localeGroups: ['core', 'extra'],
    getSubtitle: (t) => t.modal.subtitleTimeline,
    loader: () => import('./timeline/index').then((mod) => mod.default),
  },
  {
    id: 'block',
    storeKey: 'block',
    available: true,
    localeGroups: ['core', 'extra'],
    getSubtitle: (t) => t.modal.subtitleBlock,
    loader: () => import('./block/index').then((mod) => mod.default),
  },
  {
    id: 'railroad',
    storeKey: 'railroad',
    available: true,
    localeGroups: ['core', 'extra'],
    getSubtitle: (t) => t.modal.subtitleRailroad,
    loader: () => import('./railroad/index').then((mod) => mod.default),
  },
  {
    id: 'ishikawa',
    storeKey: 'ishikawa',
    available: true,
    localeGroups: ['core', 'extra'],
    getSubtitle: (t) => t.modal.subtitleIshikawa,
    loader: () => import('./ishikawa/index').then((mod) => mod.default),
  },
  {
    id: 'journey',
    storeKey: 'journey',
    available: true,
    localeGroups: ['core', 'strategy'],
    getSubtitle: (t) => t.modal.subtitleJourney,
    loader: () => import('./journey/index').then((mod) => mod.default),
  },
  {
    id: 'treemap',
    storeKey: 'treemap',
    available: true,
    localeGroups: ['core', 'strategy'],
    getSubtitle: (t) => t.modal.subtitleTreemap,
    loader: () => import('./treemap/index').then((mod) => mod.default),
  },
  {
    id: 'venn',
    storeKey: 'venn',
    available: true,
    localeGroups: ['core', 'strategy'],
    getSubtitle: (t) => t.modal.subtitleVenn,
    loader: () => import('./venn/index').then((mod) => mod.default),
  },
  {
    id: 'wardley',
    storeKey: 'wardley',
    available: true,
    localeGroups: ['core', 'strategy'],
    getSubtitle: (t) => t.modal.subtitleWardley,
    loader: () => import('./wardley/index').then((mod) => mod.default),
  },
  {
    id: 'cynefin',
    storeKey: 'cynefin',
    available: true,
    localeGroups: ['core', 'strategy'],
    getSubtitle: (t) => t.modal.subtitleCynefin,
    loader: () => import('./cynefin/index').then((mod) => mod.default),
  },
  {
    id: 'requirement',
    storeKey: 'requirement',
    available: true,
    localeGroups: ['core', 'systems'],
    getSubtitle: (t) => t.modal.subtitleRequirement,
    loader: () => import('./requirement/index').then((mod) => mod.default),
  },
  {
    id: 'packet',
    storeKey: 'packet',
    available: true,
    localeGroups: ['core', 'systems'],
    getSubtitle: (t) => t.modal.subtitlePacket,
    loader: () => import('./packet/index').then((mod) => mod.default),
  },
  {
    id: 'eventmodeling',
    storeKey: 'eventmodeling',
    available: true,
    localeGroups: ['core', 'systems'],
    getSubtitle: (t) => t.modal.subtitleEventModeling,
    loader: () => import('./eventmodeling/index').then((mod) => mod.default),
  },
  {
    id: 'sankey',
    storeKey: 'sankey',
    available: true,
    localeGroups: ['core', 'systems'],
    getSubtitle: (t) => t.modal.subtitleSankey,
    loader: () => import('./sankey/index').then((mod) => mod.default),
  },
  {
    id: 'radar',
    storeKey: 'radar',
    available: true,
    localeGroups: ['core', 'systems'],
    getSubtitle: (t) => t.modal.subtitleRadar,
    loader: () => import('./radar/index').then((mod) => mod.default),
  },
  {
    id: 'info',
    storeKey: 'info',
    available: true,
    localeGroups: ['core', 'systems'],
    getSubtitle: (t) => t.modal.subtitleInfo,
    loader: () => import('./info/index').then((mod) => mod.default),
  },
];

export const DIAGRAM_TYPE_OPTIONS: ReadonlyArray<{
  id: MermaidDiagramType;
  available: boolean;
}> = DIAGRAM_REGISTRY.map(({ id, available }) => ({ id, available }));

const REGISTRY_BY_ID = new Map<MermaidDiagramType, DiagramRegistryEntry>(
  DIAGRAM_REGISTRY.map((entry) => [entry.id, entry])
);

const handlerCache = new Map<EditableDiagramType, ErasedDiagramHandler>();
const pendingLoads = new Map<EditableDiagramType, Promise<ErasedDiagramHandler>>();

export function isEditableDiagramType(type: MermaidDiagramType): type is EditableDiagramType {
  const entry = REGISTRY_BY_ID.get(type);
  return Boolean(entry && entry.available);
}

export function getDiagramRegistryEntry(type: EditableDiagramType): DiagramRegistryEntry {
  const entry = REGISTRY_BY_ID.get(type);
  if (!entry) {
    throw new Error(`Unknown diagram type: ${type}`);
  }
  return entry;
}

export function getCachedDiagramHandler(
  type: EditableDiagramType
): ErasedDiagramHandler | undefined {
  return handlerCache.get(type);
}

export function loadDiagramHandler(
  type: EditableDiagramType
): Promise<ErasedDiagramHandler> {
  const cached = handlerCache.get(type);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = pendingLoads.get(type);
  if (pending) {
    return pending;
  }

  const entry = getDiagramRegistryEntry(type);
  const loadPromise = entry
    .loader()
    .then((handler) => {
      handlerCache.set(type, handler);
      pendingLoads.delete(type);
      return handler;
    })
    .catch((error) => {
      pendingLoads.delete(type);
      throw error;
    });

  pendingLoads.set(type, loadPromise);
  return loadPromise;
}

export function clearDiagramHandlerCache(): void {
  handlerCache.clear();
  pendingLoads.clear();
}
