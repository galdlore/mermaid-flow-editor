import '../../styles/diagrams/planning.css';
import GanttCanvas from '../../components/GanttCanvas';
import GanttInspector from '../../components/GanttInspector';
import {
  createDefaultGanttData,
  generateGanttCode,
  parseGanttCodeToGuiData,
} from '../../utils/ganttConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'gantt'>({
  id: 'gantt',
  storeKey: 'gantt',
  getSubtitle: (t) => t.modal.subtitleGantt,
  createDefault: createDefaultGanttData,
  parse: parseGanttCodeToGuiData,
  generate: generateGanttCode,
  isEmpty: (data) => data.tasks.length === 0,
  getInitialSelection: (data) => ({ nodeId: data.tasks[0]?.id ?? null, edgeId: null }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <GanttCanvas
      ganttData={data}
      selectedTaskId={selectedNodeId}
      onChange={onChange}
      onSelectTask={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <GanttInspector
      ganttData={data}
      selectedTaskId={selectedNodeId}
      onChange={onChange}
      onSelectTask={onSelectNode}
    />
  ),
});
