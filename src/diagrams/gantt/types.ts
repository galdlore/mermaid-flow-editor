export type GanttTaskStatus = 'normal' | 'active' | 'done';

export type GanttTaskStartMode = 'date' | 'after' | 'auto';

export type GanttTaskEndMode = 'duration' | 'date' | 'until';

export type GanttWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type GanttWeekend = 'saturday' | 'friday';

export interface GanttSectionData {
  id: string;
  title: string;
}

export interface GanttTaskData {
  id: string;
  label: string;
  sectionId?: string;
  status: GanttTaskStatus;
  crit?: boolean;
  milestone?: boolean;
  vert?: boolean;
  startMode: GanttTaskStartMode;
  startDate?: string;
  afterTaskIds?: string[];
  endMode: GanttTaskEndMode;
  duration?: string;
  endDate?: string;
  untilTaskIds?: string[];
  clickUrl?: string;
}

export interface GanttDiagramData {
  diagramType: 'gantt';
  title?: string;
  dateFormat: string;
  axisFormat?: string;
  tickInterval?: string;
  excludes?: string;
  includes?: string;
  todayMarker?: string;
  inclusiveEndDates?: boolean;
  topAxis?: boolean;
  compactMode?: boolean;
  weekday?: GanttWeekday;
  weekend?: GanttWeekend;
  sections: GanttSectionData[];
  tasks: GanttTaskData[];
  comments?: string[];
}
