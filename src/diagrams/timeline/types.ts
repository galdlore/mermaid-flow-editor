export type TimelineDirection = 'LR' | 'TD';

export interface TimelineSectionData {
  id: string;
  title: string;
}

export interface TimelinePeriodData {
  id: string;
  sectionId?: string;
  period: string;
  events: string[];
}

export interface TimelineDiagramData {
  diagramType: 'timeline';
  title?: string;
  direction?: TimelineDirection;
  sections: TimelineSectionData[];
  periods: TimelinePeriodData[];
  comments?: string[];
}
