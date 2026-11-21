import '../../styles/diagrams/analytics-strategy.css';
import JourneyCanvas from '../../components/JourneyCanvas';
import JourneyInspector from '../../components/JourneyInspector';
import {
  createDefaultJourneyData,
  generateJourneyCode,
  parseJourneyCodeToGuiData,
} from '../../utils/journeyConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'journey'>({
  id: 'journey',
  storeKey: 'journey',
  getSubtitle: (t) => t.modal.subtitleJourney,
  createDefault: createDefaultJourneyData,
  parse: parseJourneyCodeToGuiData,
  generate: generateJourneyCode,
  isEmpty: (data) => data.tasks.length === 0 && data.sections.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.tasks[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <JourneyCanvas
      journeyData={data}
      selectedTaskId={selectedNodeId}
      onChange={onChange}
      onSelectTask={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <JourneyInspector
      journeyData={data}
      selectedTaskId={selectedNodeId}
      onChange={onChange}
      onSelectTask={onSelectNode}
    />
  ),
});
