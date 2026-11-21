import '../../styles/diagrams/charts.css';
import QuadrantCanvas from '../../components/QuadrantCanvas';
import QuadrantInspector from '../../components/QuadrantInspector';
import {
  createDefaultQuadrantData,
  generateQuadrantCode,
  parseQuadrantCodeToGuiData,
} from '../../utils/quadrantConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'quadrantChart'>({
  id: 'quadrantChart',
  storeKey: 'quadrantChart',
  getSubtitle: (t) => t.modal.subtitleQuadrantChart,
  createDefault: createDefaultQuadrantData,
  parse: parseQuadrantCodeToGuiData,
  generate: generateQuadrantCode,
  isEmpty: () => false,
  getInitialSelection: (data) => ({ nodeId: data.points[0]?.id ?? null, edgeId: null }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <QuadrantCanvas
      data={data}
      selectedPointId={selectedNodeId}
      onChange={onChange}
      onSelectPoint={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <QuadrantInspector
      data={data}
      selectedPointId={selectedNodeId}
      onChange={onChange}
      onSelectPoint={onSelectNode}
    />
  ),
});
