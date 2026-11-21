export type WardleyStrategy = 'build' | 'buy' | 'outsource' | 'market';

export type WardleyLinkStyle =
  | 'solid'
  | 'dashed'
  | 'dotted'
  | 'flow-forward'
  | 'flow-backward'
  | 'flow-bidirectional';

export interface WardleyAnchorData {
  id: string;
  name: string;
  visibility: number;
  evolution: number;
}

export interface WardleyComponentData {
  id: string;
  name: string;
  visibility: number;
  evolution: number;
  strategy?: WardleyStrategy;
  inertia?: boolean;
  evolveTo?: number;
}

export interface WardleyLinkData {
  id: string;
  from: string;
  to: string;
  style?: WardleyLinkStyle;
  label?: string;
}

export interface WardleyNoteData {
  id: string;
  text: string;
  visibility: number;
  evolution: number;
}

export interface WardleyDiagramData {
  diagramType: 'wardley';
  title?: string;
  evolutionStages?: [string, string, string, string];
  anchors: WardleyAnchorData[];
  components: WardleyComponentData[];
  links: WardleyLinkData[];
  notes?: WardleyNoteData[];
  comments?: string[];
}
