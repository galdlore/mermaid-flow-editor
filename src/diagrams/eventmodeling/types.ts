export type EventModelingFrameKind = 'tf' | 'rf';

export type EventModelingEntityType = 'ui' | 'cmd' | 'evt' | 'rmo' | 'pcr';

export type EventModelingDataType =
  | 'json'
  | 'jsobj'
  | 'figma'
  | 'salt'
  | 'uri'
  | 'md'
  | 'html'
  | 'text';

export interface EventModelingFrameData {
  id: string;
  frameKind: EventModelingFrameKind;
  frameNumber: string;
  entityType: EventModelingEntityType;
  namespace?: string;
  entityName: string;
  sourceFrames: string[];
  dataRef?: string;
  inlineDataType?: EventModelingDataType;
  inlineData?: string;
}

export interface EventModelingDataEntity {
  id: string;
  name: string;
  dataType?: EventModelingDataType;
  body: string;
}

export interface EventModelingNoteData {
  id: string;
  frameNumber: string;
  body: string;
}

export interface EventModelingDiagramData {
  diagramType: 'eventmodeling';
  title?: string;
  frames: EventModelingFrameData[];
  dataEntities: EventModelingDataEntity[];
  notes?: EventModelingNoteData[];
  comments?: string[];
}
