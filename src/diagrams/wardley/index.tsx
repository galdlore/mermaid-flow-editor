import '../../styles/diagrams/analytics-strategy.css';
import WardleyCanvas from '../../components/WardleyCanvas';
import WardleyInspector from '../../components/WardleyInspector';
import {
  createDefaultWardleyData,
  generateWardleyCode,
  parseWardleyCodeToGuiData,
} from '../../utils/wardleyConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'wardley'>({
  id: 'wardley',
  storeKey: 'wardley',
  getSubtitle: (t) => t.modal.subtitleWardley,
  createDefault: createDefaultWardleyData,
  parse: parseWardleyCodeToGuiData,
  generate: generateWardleyCode,
  isEmpty: (data) =>
    data.anchors.length === 0 &&
    data.components.length === 0 &&
    (data.notes?.length ?? 0) === 0,
  getInitialSelection: (data) => ({
    nodeId: data.components[0]?.id ?? data.anchors[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <WardleyCanvas
      wardleyData={data}
      selectedItemId={selectedNodeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <WardleyInspector
      wardleyData={data}
      selectedItemId={selectedNodeId}
      onChange={onChange}
      onSelectItem={onSelectNode}
    />
  ),
});
