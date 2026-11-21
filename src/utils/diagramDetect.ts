import type { MermaidDiagramType } from '../types/editor.ts';
import { GUI_STATE_PREFIX } from './mermaidEnvelope.ts';

export interface DiagramManifestEntry {
  type: MermaidDiagramType;
  guiStateArrayFields?: ReadonlyArray<string>;
  headerRegex?: RegExp;
}

export const DIAGRAM_MANIFESTS: ReadonlyArray<DiagramManifestEntry> = [
  {
    type: 'treeView',
    guiStateArrayFields: ['nodes'],
    headerRegex: /^treeView-beta\b/i,
  },
  {
    type: 'gantt',
    guiStateArrayFields: ['tasks'],
    headerRegex: /^gantt\b/i,
  },
  {
    type: 'kanban',
    guiStateArrayFields: ['columns'],
    headerRegex: /^kanban\b/i,
  },
  {
    type: 'pie',
    guiStateArrayFields: ['slices'],
    headerRegex: /^pie\b/i,
  },
  {
    type: 'xychart',
    guiStateArrayFields: ['series'],
    headerRegex: /^xychart(-beta)?\b/i,
  },
  {
    type: 'architecture',
    guiStateArrayFields: ['nodes'],
    headerRegex: /^architecture(?:-beta)?\b/i,
  },
  {
    type: 'mindmap',
    guiStateArrayFields: ['nodes'],
    headerRegex: /^mindmap\b/i,
  },
  {
    type: 'quadrantChart',
    guiStateArrayFields: ['points'],
    headerRegex: /^quadrantChart\b/i,
  },
  {
    type: 'sequence',
    guiStateArrayFields: ['participants', 'steps'],
    headerRegex: /^sequenceDiagram\b/i,
  },
  {
    type: 'er',
    guiStateArrayFields: ['entities', 'relationships'],
    headerRegex: /^erDiagram\b/i,
  },
  {
    type: 'class',
    guiStateArrayFields: ['classes', 'relations'],
    headerRegex: /^classDiagram(?:-v2)?\b/i,
  },
  {
    type: 'state',
    guiStateArrayFields: ['states', 'transitions'],
    headerRegex: /^stateDiagram(?:-v2)?\b/i,
  },
  {
    type: 'c4',
    guiStateArrayFields: ['elements', 'boundaries', 'relations'],
    headerRegex: /^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i,
  },
  {
    type: 'gitGraph',
    guiStateArrayFields: ['operations'],
    headerRegex: /^gitGraph\b/i,
  },
  {
    type: 'timeline',
    guiStateArrayFields: ['periods'],
    headerRegex: /^timeline\b/i,
  },
  {
    type: 'block',
    guiStateArrayFields: ['items'],
    headerRegex: /^block(?:-beta)?\b/i,
  },
  {
    type: 'railroad',
    guiStateArrayFields: ['rules'],
    headerRegex: /^railroad(?:-(?:ebnf|abnf|peg))?-beta\b/i,
  },
  {
    type: 'ishikawa',
    guiStateArrayFields: ['nodes'],
    headerRegex: /^ishikawa(?:-beta)?\b/i,
  },
  {
    type: 'journey',
    guiStateArrayFields: ['tasks'],
    headerRegex: /^journey\b/i,
  },
  {
    type: 'treemap',
    guiStateArrayFields: ['nodes'],
    headerRegex: /^treemap(?:-beta)?\b/i,
  },
  {
    type: 'venn',
    guiStateArrayFields: ['sets'],
    headerRegex: /^venn-beta\b/i,
  },
  {
    type: 'wardley',
    guiStateArrayFields: ['components'],
    headerRegex: /^wardley-beta\b/i,
  },
  {
    type: 'cynefin',
    guiStateArrayFields: ['items'],
    headerRegex: /^cynefin-beta(?:[\s:]|$)/i,
  },
  {
    type: 'requirement',
    guiStateArrayFields: ['requirements', 'elements', 'relations'],
    headerRegex: /^requirement(?:Diagram)?\b/i,
  },
  {
    type: 'packet',
    guiStateArrayFields: ['blocks'],
    headerRegex: /^packet(?:-beta)?\b/i,
  },
  {
    type: 'eventmodeling',
    guiStateArrayFields: ['frames'],
    headerRegex: /^eventmodeling\b/i,
  },
  {
    type: 'sankey',
    guiStateArrayFields: ['links'],
    headerRegex: /^sankey(?:-beta)?\b/i,
  },
  {
    type: 'radar',
    guiStateArrayFields: ['axes', 'curves'],
    headerRegex: /^radar-beta\b/i,
  },
  {
    type: 'info',
    guiStateArrayFields: [],
    headerRegex: /^info\b/i,
  },
  {
    type: 'swimlane',
    guiStateArrayFields: ['nodes', 'edges'],
    headerRegex: /^swimlane-beta\b/i,
  },
  {
    type: 'flowchart',
  },
];

function matchesGuiStateManifest(
  parsed: Record<string, unknown>,
  entry: DiagramManifestEntry
): boolean {
  if (parsed.diagramType !== entry.type || !entry.guiStateArrayFields) {
    return false;
  }
  return entry.guiStateArrayFields.every((field) => Array.isArray(parsed[field]));
}

export function detectMermaidDiagramType(code: string): MermaidDiagramType {
  const lines = code.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(GUI_STATE_PREFIX)) {
      const jsonPart = trimmed.slice(GUI_STATE_PREFIX.length).trim();
      try {
        const parsed: unknown = JSON.parse(jsonPart);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const obj = parsed as Record<string, unknown>;
          for (const manifest of DIAGRAM_MANIFESTS) {
            if (matchesGuiStateManifest(obj, manifest)) {
              return manifest.type;
            }
          }
        }
      } catch {
        // JSON解析失敗時はテキスト判定へフォールバックする
      }
    }
  }

  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
      }
      continue;
    }
    if (!trimmed || trimmed.startsWith('%%')) {
      continue;
    }
    for (const manifest of DIAGRAM_MANIFESTS) {
      if (manifest.headerRegex && manifest.headerRegex.test(trimmed)) {
        return manifest.type;
      }
    }
    break;
  }

  return 'flowchart';
}
