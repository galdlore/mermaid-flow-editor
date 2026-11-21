import '../../styles/diagrams/uml-modeling.css';
import StateCanvas from '../../components/StateCanvas';
import StateInspector from '../../components/StateInspector';
import {
  createDefaultStateData,
  generateStateCode,
  parseStateCodeToGuiData,
} from '../../utils/stateConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'state'>({
  id: 'state',
  storeKey: 'state',
  getSubtitle: (t) => t.modal.subtitleState,
  createDefault: createDefaultStateData,
  parse: parseStateCodeToGuiData,
  generate: generateStateCode,
  isEmpty: (data) => data.states.length === 0 && data.transitions.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.states[0]?.id ?? null,
    edgeId: data.transitions[0]?.id ?? null,
  }),
  renderCanvas: ({
    data,
    selectedNodeId,
    selectedEdgeId,
    onChange,
    onSelectNode,
    onSelectEdge,
  }) => (
    <StateCanvas
      stateData={data}
      selectedStateId={selectedNodeId}
      selectedTransitionId={selectedEdgeId}
      onChange={onChange}
      onSelectState={onSelectNode}
      onSelectTransition={onSelectEdge}
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
    <StateInspector
      stateData={data}
      selectedStateId={selectedNodeId}
      selectedTransitionId={selectedEdgeId}
      onChange={onChange}
      onSelectState={onSelectNode}
      onSelectTransition={onSelectEdge}
    />
  ),
});
