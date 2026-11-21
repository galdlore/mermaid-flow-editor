export interface JourneySectionData {
  id: string;
  title: string;
}

export interface JourneyTaskData {
  id: string;
  label: string;
  score: number;
  actors: string[];
  sectionId?: string;
}

export interface JourneyDiagramData {
  diagramType: 'journey';
  title?: string;
  sections: JourneySectionData[];
  tasks: JourneyTaskData[];
  comments?: string[];
}
