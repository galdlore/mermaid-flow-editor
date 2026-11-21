import '../../styles/diagrams/architecture-mindmap.css';
import MindmapCanvas from '../../components/MindmapCanvas';
import MindmapInspector from '../../components/MindmapInspector';
import {
  createDefaultMindmapData,
  generateMindmapCode,
  parseMindmapCodeToGuiData,
} from '../../utils/mindmapConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'mindmap'>({
  id: 'mindmap',
  storeKey: 'mindmap',
  getSubtitle: (t) => t.modal.subtitleMindmap,
  createDefault: createDefaultMindmapData,
  parse: parseMindmapCodeToGuiData,
  generate: generateMindmapCode,
  isEmpty: (data) => data.nodes.length === 0,
  getInitialSelection: (data) => ({ nodeId: data.nodes[0]?.id ?? null, edgeId: null }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <MindmapCanvas
      mindmapData={data}
      selectedNodeId={selectedNodeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <MindmapInspector
      mindmapData={data}
      selectedNodeId={selectedNodeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
    />
  ),
});
