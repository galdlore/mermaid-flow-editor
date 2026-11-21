import '../../styles/diagrams/systems-data.css';
import RadarCanvas from '../../components/RadarCanvas';
import RadarInspector from '../../components/RadarInspector';
import {
  createDefaultRadarData,
  generateRadarCode,
  parseRadarCodeToGuiData,
} from '../../utils/radarConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'radar'>({
  id: 'radar',
  storeKey: 'radar',
  getSubtitle: (t) => t.modal.subtitleRadar,
  createDefault: createDefaultRadarData,
  parse: parseRadarCodeToGuiData,
  generate: generateRadarCode,
  isEmpty: (data) => data.axes.length === 0,
  getInitialSelection: (data) => ({
    nodeId: data.curves[0]?.id ?? null,
    edgeId: null,
  }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <RadarCanvas
      radarData={data}
      selectedCurveId={selectedNodeId}
      onChange={onChange}
      onSelectCurve={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <RadarInspector
      radarData={data}
      selectedCurveId={selectedNodeId}
      onChange={onChange}
      onSelectCurve={onSelectNode}
    />
  ),
});
