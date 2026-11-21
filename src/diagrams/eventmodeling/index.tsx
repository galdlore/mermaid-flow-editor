import '../../styles/diagrams/systems-data.css';
import EventModelingCanvas from '../../components/EventModelingCanvas';
import EventModelingInspector from '../../components/EventModelingInspector';
import {
  createDefaultEventModelingData,
  generateEventModelingCode,
  parseEventModelingCodeToGuiData,
} from '../../utils/eventModelingConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'eventmodeling'>({
  id: 'eventmodeling',
  storeKey: 'eventmodeling',
  getSubtitle: (t) => t.modal.subtitleEventModeling,
  createDefault: createDefaultEventModelingData,
  parse: parseEventModelingCodeToGuiData,
  generate: generateEventModelingCode,
  isEmpty: (data) => data.frames.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.frames[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <EventModelingCanvas
      eventModelingData={data}
      selectedFrameId={selectedNodeId}
      onChange={onChange}
      onSelectFrame={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <EventModelingInspector
      eventModelingData={data}
      selectedFrameId={selectedNodeId}
      onChange={onChange}
      onSelectFrame={onSelectNode}
    />
  ),
});
