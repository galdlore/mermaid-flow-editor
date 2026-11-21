import '../../styles/diagrams/systems-data.css';
import RequirementCanvas from '../../components/RequirementCanvas';
import RequirementInspector from '../../components/RequirementInspector';
import {
  createDefaultRequirementData,
  generateRequirementCode,
  parseRequirementCodeToGuiData,
} from '../../utils/requirementConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'requirement'>({
  id: 'requirement',
  storeKey: 'requirement',
  getSubtitle: (t) => t.modal.subtitleRequirement,
  createDefault: createDefaultRequirementData,
  parse: parseRequirementCodeToGuiData,
  generate: generateRequirementCode,
  isEmpty: (data) =>
    data.requirements.length === 0 && data.elements.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.requirements[0]?.id ?? data.elements[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <RequirementCanvas
      requirementData={data}
      selectedItemId={selectedNodeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <RequirementInspector
      requirementData={data}
      selectedItemId={selectedNodeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
    />
  ),
});
