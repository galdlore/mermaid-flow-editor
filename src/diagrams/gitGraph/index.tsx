import '../../styles/diagrams/extra-diagrams.css';
import GitGraphCanvas from '../../components/GitGraphCanvas';
import GitGraphInspector from '../../components/GitGraphInspector';
import {
  createDefaultGitGraphData,
  generateGitGraphCode,
  parseGitGraphCodeToGuiData,
} from '../../utils/gitGraphConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'gitGraph'>({
  id: 'gitGraph',
  storeKey: 'gitGraph',
  getSubtitle: (t) => t.modal.subtitleGitGraph,
  createDefault: createDefaultGitGraphData,
  parse: parseGitGraphCodeToGuiData,
  generate: generateGitGraphCode,
  isEmpty: (data) => data.operations.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.operations[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <GitGraphCanvas
      gitData={data}
      selectedOperationId={selectedNodeId}
      onChange={onChange}
      onSelectOperation={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <GitGraphInspector
      gitData={data}
      selectedOperationId={selectedNodeId}
      onChange={onChange}
      onSelectOperation={onSelectNode}
    />
  ),
});
