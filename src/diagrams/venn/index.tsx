import '../../styles/diagrams/analytics-strategy.css';
import VennCanvas from '../../components/VennCanvas';
import VennInspector from '../../components/VennInspector';
import {
  createDefaultVennData,
  generateVennCode,
  parseVennCodeToGuiData,
} from '../../utils/vennConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'venn'>({
  id: 'venn',
  storeKey: 'venn',
  getSubtitle: (t) => t.modal.subtitleVenn,
  createDefault: createDefaultVennData,
  parse: parseVennCodeToGuiData,
  generate: generateVennCode,
  isEmpty: (data) => data.sets.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.sets[0]?.id ?? null,
    edgeId: data.unions[0]?.id ?? null,
  }),
  renderCanvas: ({
    data,
    selectedNodeId,
    selectedEdgeId,
    onChange,
    onSelectNode,
    onSelectEdge,
  }) => (
    <VennCanvas
      vennData={data}
      selectedSetId={selectedNodeId}
      selectedUnionId={selectedEdgeId}
      onChange={onChange}
      onSelectSet={onSelectNode}
      onSelectUnion={onSelectEdge}
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
    <VennInspector
      vennData={data}
      selectedSetId={selectedNodeId}
      selectedUnionId={selectedEdgeId}
      onChange={onChange}
      onSelectSet={onSelectNode}
      onSelectUnion={onSelectEdge}
    />
  ),
});
