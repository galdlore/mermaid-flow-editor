import '../../styles/diagrams/analytics-strategy.css';
import TreemapCanvas from '../../components/TreemapCanvas';
import TreemapInspector from '../../components/TreemapInspector';
import {
  createDefaultTreemapData,
  generateTreemapCode,
  parseTreemapCodeToGuiData,
} from '../../utils/treemapConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'treemap'>({
  id: 'treemap',
  storeKey: 'treemap',
  getSubtitle: (t) => t.modal.subtitleTreemap,
  createDefault: createDefaultTreemapData,
  parse: parseTreemapCodeToGuiData,
  generate: generateTreemapCode,
  isEmpty: (data) => data.nodes.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.nodes[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <TreemapCanvas
      treemapData={data}
      selectedNodeId={selectedNodeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <TreemapInspector
      treemapData={data}
      selectedNodeId={selectedNodeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
    />
  ),
});
