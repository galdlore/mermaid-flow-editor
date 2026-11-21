import '../../styles/diagrams/charts.css';
import XYChartCanvas from '../../components/XYChartCanvas';
import XYChartInspector from '../../components/XYChartInspector';
import {
  createDefaultXYChartData,
  generateXYChartCode,
  parseXYChartCodeToGuiData,
} from '../../utils/xychartConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'xychart'>({
  id: 'xychart',
  storeKey: 'xychart',
  getSubtitle: (t) => t.modal.subtitleXYChart,
  createDefault: createDefaultXYChartData,
  parse: parseXYChartCodeToGuiData,
  generate: generateXYChartCode,
  isEmpty: (data) => data.series.length === 0,
  getInitialSelection: (data) => ({ nodeId: data.series[0]?.id ?? null, edgeId: null }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <XYChartCanvas
      xychartData={data}
      selectedSeriesId={selectedNodeId}
      onChange={onChange}
      onSelectSeries={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <XYChartInspector
      xychartData={data}
      selectedSeriesId={selectedNodeId}
      onChange={onChange}
      onSelectSeries={onSelectNode}
    />
  ),
});
