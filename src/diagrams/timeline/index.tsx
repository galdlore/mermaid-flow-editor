import '../../styles/diagrams/extra-diagrams.css';
import TimelineCanvas from '../../components/TimelineCanvas';
import TimelineInspector from '../../components/TimelineInspector';
import {
  createDefaultTimelineData,
  generateTimelineCode,
  parseTimelineCodeToGuiData,
} from '../../utils/timelineConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'timeline'>({
  id: 'timeline',
  storeKey: 'timeline',
  getSubtitle: (t) => t.modal.subtitleTimeline,
  createDefault: createDefaultTimelineData,
  parse: parseTimelineCodeToGuiData,
  generate: generateTimelineCode,
  isEmpty: (data) => data.periods.length === 0 && data.sections.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.periods[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <TimelineCanvas
      timelineData={data}
      selectedPeriodId={selectedNodeId}
      onChange={onChange}
      onSelectPeriod={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <TimelineInspector
      timelineData={data}
      selectedPeriodId={selectedNodeId}
      onChange={onChange}
      onSelectPeriod={onSelectNode}
    />
  ),
});
