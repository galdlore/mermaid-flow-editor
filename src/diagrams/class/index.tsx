import '../../styles/diagrams/uml-modeling.css';
import ClassCanvas from '../../components/ClassCanvas';
import ClassInspector from '../../components/ClassInspector';
import {
  createDefaultClassData,
  generateClassCode,
  parseClassCodeToGuiData,
} from '../../utils/classConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'class'>({
  id: 'class',
  storeKey: 'class',
  getSubtitle: (t) => t.modal.subtitleClass,
  createDefault: createDefaultClassData,
  parse: parseClassCodeToGuiData,
  generate: generateClassCode,
  isEmpty: (data) => data.classes.length === 0 && data.relations.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.classes[0]?.id ?? null,
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
    <ClassCanvas
      classData={data}
      selectedClassId={selectedNodeId}
      selectedRelationId={selectedEdgeId}
      onChange={onChange}
      onSelectClass={onSelectNode}
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
    <ClassInspector
      classData={data}
      selectedClassId={selectedNodeId}
      selectedRelationId={selectedEdgeId}
      onChange={onChange}
      onSelectClass={onSelectNode}
      onSelectRelation={onSelectEdge}
    />
  ),
});
