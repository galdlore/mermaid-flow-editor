import '../../styles/diagrams/extra-diagrams.css';
import IshikawaCanvas from '../../components/IshikawaCanvas';
import IshikawaInspector from '../../components/IshikawaInspector';
import {
  createDefaultIshikawaData,
  generateIshikawaCode,
  parseIshikawaCodeToGuiData,
} from '../../utils/ishikawaConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'ishikawa'>({
  id: 'ishikawa',
  storeKey: 'ishikawa',
  getSubtitle: (t) => t.modal.subtitleIshikawa,
  createDefault: createDefaultIshikawaData,
  parse: parseIshikawaCodeToGuiData,
  generate: generateIshikawaCode,
  isEmpty: (data) => data.nodes.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.nodes[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <IshikawaCanvas
      ishikawaData={data}
      selectedNodeId={selectedNodeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <IshikawaInspector
      ishikawaData={data}
      selectedNodeId={selectedNodeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
    />
  ),
});
