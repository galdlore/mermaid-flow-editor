import '../../styles/diagrams/uml-modeling.css';
import SequenceCanvas from '../../components/SequenceCanvas';
import SequenceInspector from '../../components/SequenceInspector';
import {
  createDefaultSequenceData,
  generateSequenceCode,
  parseSequenceCodeToGuiData,
} from '../../utils/sequenceConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'sequence'>({
  id: 'sequence',
  storeKey: 'sequence',
  getSubtitle: (t) => t.modal.subtitleSequence,
  createDefault: createDefaultSequenceData,
  parse: parseSequenceCodeToGuiData,
  generate: generateSequenceCode,
  isEmpty: (data) => data.participants.length === 0 && data.steps.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.steps[0]?.id ?? null,
    edgeId: data.participants[0]?.id ?? null,
  }),
  renderCanvas: ({
    data,
    selectedNodeId,
    selectedEdgeId,
    onChange,
    onSelectNode,
    onSelectEdge,
  }) => (
    <SequenceCanvas
      sequenceData={data}
      selectedStepId={selectedNodeId}
      selectedParticipantId={selectedEdgeId}
      onChange={onChange}
      onSelectStep={onSelectNode}
      onSelectParticipant={onSelectEdge}
    />
  ),
  renderInspector: ({
    data,
    selectedNodeId,
    selectedEdgeId,
    onChange,
    onSelectNode,
    onSelectEdge,
  }) => (
    <SequenceInspector
      sequenceData={data}
      selectedStepId={selectedNodeId}
      selectedParticipantId={selectedEdgeId}
      onChange={onChange}
      onSelectStep={onSelectNode}
      onSelectParticipant={onSelectEdge}
    />
  ),
});
