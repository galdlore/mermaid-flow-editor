import '../../styles/diagrams/uml-modeling.css';
import C4Canvas from '../../components/C4Canvas';
import C4Inspector from '../../components/C4Inspector';
import {
  createDefaultC4Data,
  generateC4Code,
  parseC4CodeToGuiData,
} from '../../utils/c4Converter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'c4'>({
  id: 'c4',
  storeKey: 'c4',
  getSubtitle: (t) => t.modal.subtitleC4,
  createDefault: createDefaultC4Data,
  parse: parseC4CodeToGuiData,
  generate: generateC4Code,
  isEmpty: (data) => data.elements.length === 0 && data.boundaries.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.elements[0]?.id ?? data.boundaries[0]?.id ?? null,
    edgeId: data.relations[0]?.id ?? null,
  }),
  renderCanvas: ({
    data,
    selectedNodeId,
    selectedEdgeId,
    onChange,
    onSelectNode,
    onSelectEdge,
  }) => (
    <C4Canvas
      c4Data={data}
      selectedItemId={selectedNodeId}
      selectedRelationId={selectedEdgeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
      onSelectRelation={onSelectEdge}
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
    <C4Inspector
      c4Data={data}
      selectedItemId={selectedNodeId}
      selectedRelationId={selectedEdgeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
      onSelectRelation={onSelectEdge}
    />
  ),
});
