export type CynefinDomainName =
  | 'complex'
  | 'complicated'
  | 'clear'
  | 'chaotic'
  | 'confusion';

export interface CynefinItemData {
  id: string;
  domain: CynefinDomainName;
  label: string;
}

export interface CynefinTransitionData {
  id: string;
  from: CynefinDomainName;
  to: CynefinDomainName;
  label?: string;
}

export interface CynefinDiagramData {
  diagramType: 'cynefin';
  title?: string;
  items: CynefinItemData[];
  transitions: CynefinTransitionData[];
  comments?: string[];
}
