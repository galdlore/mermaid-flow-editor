import '../../styles/diagrams/planning.css';
import KanbanCanvas from '../../components/KanbanCanvas';
import KanbanInspector from '../../components/KanbanInspector';
import {
  createDefaultKanbanData,
  generateKanbanCode,
  parseKanbanCodeToGuiData,
} from '../../utils/kanbanConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'kanban'>({
  id: 'kanban',
  storeKey: 'kanban',
  getSubtitle: (t) => t.modal.subtitleKanban,
  createDefault: createDefaultKanbanData,
  parse: parseKanbanCodeToGuiData,
  generate: generateKanbanCode,
  isEmpty: (data) => data.columns.length === 0,
  getInitialSelection: (data) => ({ nodeId: data.cards[0]?.id ?? null, edgeId: null }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <KanbanCanvas
      kanbanData={data}
      selectedCardId={selectedNodeId}
      onChange={onChange}
      onSelectCard={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <KanbanInspector
      kanbanData={data}
      selectedCardId={selectedNodeId}
      onChange={onChange}
      onSelectCard={onSelectNode}
    />
  ),
});
