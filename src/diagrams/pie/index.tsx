import '../../styles/diagrams/charts.css';
import PieCanvas from '../../components/PieCanvas';
import PieInspector from '../../components/PieInspector';
import {
  createDefaultPieData,
  generatePieCode,
  parsePieCodeToGuiData,
} from '../../utils/pieConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'pie'>({
  id: 'pie',
  storeKey: 'pie',
  getSubtitle: (t) => t.modal.subtitlePie,
  createDefault: createDefaultPieData,
  parse: parsePieCodeToGuiData,
  generate: generatePieCode,
  isEmpty: (data) => data.slices.length === 0,
  getInitialSelection: (data) => ({ nodeId: data.slices[0]?.id ?? null, edgeId: null }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <PieCanvas
      pieData={data}
      selectedSliceId={selectedNodeId}
      onChange={onChange}
      onSelectSlice={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <PieInspector
      pieData={data}
      selectedSliceId={selectedNodeId}
      onChange={onChange}
      onSelectSlice={onSelectNode}
    />
  ),
});
