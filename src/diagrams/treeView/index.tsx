import '../../styles/diagrams/planning.css';
import TreeViewCanvas from '../../components/TreeViewCanvas';
import TreeViewInspector from '../../components/TreeViewInspector';
import {
  createDefaultTreeViewData,
  generateTreeViewCode,
  parseTreeViewCodeToGuiData,
} from '../../utils/treeViewConverter';
import { defineDiagramHandler } from '../types';

export default defineDiagramHandler<'treeView'>({
  id: 'treeView',
  storeKey: 'treeView',
  getSubtitle: (t) => t.modal.subtitleTreeView,
  createDefault: createDefaultTreeViewData,
  parse: parseTreeViewCodeToGuiData,
  generate: generateTreeViewCode,
  isEmpty: (data) => data.nodes.length === 0,
  getInitialSelection: (data) => ({ nodeId: data.nodes[0]?.id ?? null, edgeId: null }),
  renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <TreeViewCanvas
      treeData={data}
      selectedNodeId={selectedNodeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
    />
  ),
  renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
    <TreeViewInspector
      treeData={data}
      selectedNodeId={selectedNodeId}
      onChange={onChange}
      onSelectNode={onSelectNode}
    />
  ),
});
