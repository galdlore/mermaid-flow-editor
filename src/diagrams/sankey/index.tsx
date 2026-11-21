import '../../styles/diagrams/systems-data.css';
import SankeyCanvas from '../../components/SankeyCanvas';
import SankeyInspector from '../../components/SankeyInspector';
import {
  createDefaultSankeyData,
  generateSankeyCode,
  parseSankeyCodeToGuiData,
} from '../../utils/sankeyConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'sankey'>({
  id: 'sankey',
  storeKey: 'sankey',
  getSubtitle: (t) => t.modal.subtitleSankey,
  createDefault: createDefaultSankeyData,
  parse: parseSankeyCodeToGuiData,
  generate: generateSankeyCode,
  isEmpty: (data) => data.links.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.links[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <SankeyCanvas
      sankeyData={data}
      selectedLinkId={selectedNodeId}
      onChange={onChange}
      onSelectLink={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <SankeyInspector
      sankeyData={data}
      selectedLinkId={selectedNodeId}
      onChange={onChange}
      onSelectLink={onSelectNode}
    />
  ),
});
