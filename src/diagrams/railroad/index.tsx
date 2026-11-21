import '../../styles/diagrams/extra-diagrams.css';
import RailroadCanvas from '../../components/RailroadCanvas';
import RailroadInspector from '../../components/RailroadInspector';
import {
  createDefaultRailroadData,
  generateRailroadCode,
  parseRailroadCodeToGuiData,
} from '../../utils/railroadConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'railroad'>({
  id: 'railroad',
  storeKey: 'railroad',
  getSubtitle: (t) => t.modal.subtitleRailroad,
  createDefault: createDefaultRailroadData,
  parse: parseRailroadCodeToGuiData,
  generate: generateRailroadCode,
  isEmpty: (data) => data.rules.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.rules[0]?.root.id ?? null,
    edgeId: data.rules[0]?.id ?? null,
  }),
  renderCanvas: ({
    data,
    selectedNodeId,
    selectedEdgeId,
    onChange,
    onSelectNode,
    onSelectEdge,
  }) => (
    <RailroadCanvas
      railroadData={data}
      selectedNodeId={selectedNodeId}
      selectedRuleId={selectedEdgeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
      onSelectRule={onSelectEdge}
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
    <RailroadInspector
      railroadData={data}
      selectedNodeId={selectedNodeId}
      selectedRuleId={selectedEdgeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
      onSelectRule={onSelectEdge}
    />
  ),
});
