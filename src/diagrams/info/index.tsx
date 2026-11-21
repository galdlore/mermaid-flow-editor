import '../../styles/diagrams/systems-data.css';
import InfoCanvas from '../../components/InfoCanvas';
import InfoInspector from '../../components/InfoInspector';
import {
  createDefaultInfoData,
  generateInfoCode,
  parseInfoCodeToGuiData,
} from '../../utils/infoConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'info'>({
  id: 'info',
  storeKey: 'info',
  getSubtitle: (t) => t.modal.subtitleInfo,
  createDefault: createDefaultInfoData,
  parse: parseInfoCodeToGuiData,
  generate: generateInfoCode,
  isEmpty: () => false,
  getInitialSelection: () => ({
    nodeId: null,
    edgeId: null,
  }),
  renderCanvas: ({ data }) => <InfoCanvas infoData={data} />,
  renderInspector: ({ data, onChange }) => (
    <InfoInspector infoData={data} onChange={onChange} />
  ),
});
