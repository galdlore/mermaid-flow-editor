import '../../styles/diagrams/uml-modeling.css';
import ErCanvas from '../../components/ErCanvas';
import ErInspector from '../../components/ErInspector';
import {
  createDefaultErData,
  generateErCode,
  parseErCodeToGuiData,
} from '../../utils/erConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'er'>({
  id: 'er',
  storeKey: 'er',
  getSubtitle: (t) => t.modal.subtitleEr,
  createDefault: createDefaultErData,
  parse: parseErCodeToGuiData,
  generate: generateErCode,
  isEmpty: (data) => data.entities.length === 0 && data.relationships.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.entities[0]?.id ?? null,
    edgeId: data.relationships[0]?.id ?? null,
  }),
  renderCanvas: ({
    data,
    selectedNodeId,
    selectedEdgeId,
    onChange,
    onSelectNode,
    onSelectEdge,
  }) => (
    <ErCanvas
      erData={data}
      selectedEntityId={selectedNodeId}
      selectedRelationshipId={selectedEdgeId}
      onChange={onChange}
      onSelectEntity={onSelectNode}
      onSelectRelationship={onSelectEdge}
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
    <ErInspector
      erData={data}
      selectedEntityId={selectedNodeId}
      selectedRelationshipId={selectedEdgeId}
      onChange={onChange}
      onSelectEntity={onSelectNode}
      onSelectRelationship={onSelectEdge}
    />
  ),
});
