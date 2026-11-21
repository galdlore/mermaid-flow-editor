import '../../styles/diagrams/extra-diagrams.css';
import BlockCanvas from '../../components/BlockCanvas';
import BlockInspector from '../../components/BlockInspector';
import {
  createDefaultBlockData,
  generateBlockCode,
  parseBlockCodeToGuiData,
} from '../../utils/blockConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'block'>({
  id: 'block',
  storeKey: 'block',
  getSubtitle: (t) => t.modal.subtitleBlock,
  createDefault: createDefaultBlockData,
  parse: parseBlockCodeToGuiData,
  generate: generateBlockCode,
  isEmpty: (data) => data.items.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.items[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <BlockCanvas
      blockData={data}
      selectedItemId={selectedNodeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <BlockInspector
      blockData={data}
      selectedItemId={selectedNodeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
    />
  ),
});
