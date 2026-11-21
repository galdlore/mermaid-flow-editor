import '../../styles/diagrams/systems-data.css';
import PacketCanvas from '../../components/PacketCanvas';
import PacketInspector from '../../components/PacketInspector';
import {
  createDefaultPacketData,
  generatePacketCode,
  parsePacketCodeToGuiData,
} from '../../utils/packetConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'packet'>({
  id: 'packet',
  storeKey: 'packet',
  getSubtitle: (t) => t.modal.subtitlePacket,
  createDefault: createDefaultPacketData,
  parse: parsePacketCodeToGuiData,
  generate: generatePacketCode,
  isEmpty: (data) => data.blocks.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.blocks[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <PacketCanvas
      packetData={data}
      selectedBlockId={selectedNodeId}
      onChange={onChange}
      onSelectBlock={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <PacketInspector
      packetData={data}
      selectedBlockId={selectedNodeId}
      onChange={onChange}
      onSelectBlock={onSelectNode}
    />
  ),
});
