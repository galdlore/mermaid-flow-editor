import '../../styles/diagrams/analytics-strategy.css';
import CynefinCanvas from '../../components/CynefinCanvas';
import CynefinInspector from '../../components/CynefinInspector';
import {
  createDefaultCynefinData,
  generateCynefinCode,
  parseCynefinCodeToGuiData,
} from '../../utils/cynefinConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'cynefin'>({
  id: 'cynefin',
  storeKey: 'cynefin',
  getSubtitle: (t) => t.modal.subtitleCynefin,
  createDefault: createDefaultCynefinData,
  parse: parseCynefinCodeToGuiData,
  generate: generateCynefinCode,
  isEmpty: (data) => data.items.length === 0 && data.transitions.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.items[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <CynefinCanvas
      cynefinData={data}
      selectedItemId={selectedNodeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <CynefinInspector
      cynefinData={data}
      selectedItemId={selectedNodeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
    />
  ),
});
