import '../../styles/diagrams/architecture-mindmap.css';
import ArchitectureCanvas from '../../components/ArchitectureCanvas';
import ArchitectureInspector from '../../components/ArchitectureInspector';
import {
  createDefaultArchitectureData,
  generateArchitectureCode,
  parseArchitectureCodeToGuiData,
} from '../../utils/architectureConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'architecture'>({
  id: 'architecture',
  storeKey: 'architecture',
  getSubtitle: (t) => t.modal.subtitleArchitecture,
  createDefault: createDefaultArchitectureData,
  parse: parseArchitectureCodeToGuiData,
  generate: generateArchitectureCode,
  isEmpty: (data) => data.nodes.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.nodes[0]?.id ?? null,
    edgeId: data.edges[0]?.id ?? null,
  }),
  renderCanvas: ({
    data,
    selectedNodeId,
    selectedEdgeId,
    onChange,
    onSelectNode,
    onSelectEdge,
  }) => (
    <ArchitectureCanvas
      architectureData={data}
      selectedNodeId={selectedNodeId}
      selectedEdgeId={selectedEdgeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
      onSelectEdge={onSelectEdge}
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
    <ArchitectureInspector
      architectureData={data}
      selectedNodeId={selectedNodeId}
      selectedEdgeId={selectedEdgeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
      onSelectEdge={onSelectEdge}
    />
  ),
});
