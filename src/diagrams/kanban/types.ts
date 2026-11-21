export type KanbanPriority =
  | 'Very High'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Very Low';

export interface KanbanColumnData {
  id: string;
  title: string;
}

export interface KanbanCardData {
  id: string;
  label: string;
  columnId: string;
  assigned?: string;
  ticket?: string;
  priority?: KanbanPriority;
}

export interface KanbanDiagramData {
  diagramType: 'kanban';
  columns: KanbanColumnData[];
  cards: KanbanCardData[];
  ticketBaseUrl?: string;
  sectionWidth?: number;
  comments?: string[];
}
