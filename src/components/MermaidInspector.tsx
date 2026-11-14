import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  EdgeLineType,
  MermaidDiagramData,
  MermaidDirection,
  MermaidEdgeData,
  MermaidNodeData,
  NodeShape,
} from '../types/editor';

export interface MermaidInspectorProps {
  diagramData: MermaidDiagramData;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onChange: (next: MermaidDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

const DIRECTION_OPTIONS: Array<{ value: MermaidDirection; label: string }> = [
  { value: 'TD', label: '上から下 (TD)' },
  { value: 'LR', label: '左から右 (LR)' },
  { value: 'BT', label: '下から上 (BT)' },
  { value: 'RL', label: '右から左 (RL)' },
];

const SHAPE_OPTIONS: Array<{ value: NodeShape; label: string }> = [
  { value: 'rect', label: '四角形' },
  { value: 'round', label: '角丸' },
  { value: 'diamond', label: 'ひし形' },
  { value: 'circle', label: '円形' },
  { value: 'stadium', label: 'カプセル' },
];

const LINE_TYPE_OPTIONS: Array<{ value: EdgeLineType; label: string }> = [
  { value: 'arrow', label: '実線矢印 (-->)' },
  { value: 'dotted', label: '点線矢印 (-.->)' },
  { value: 'thick', label: '太線矢印 (==>)' },
  { value: 'line', label: '線のみ (---)' },
];

const COLOR_PALETTE = [
  { value: '#ffffff', label: '白' },
  { value: '#eff6ff', label: '青' },
  { value: '#f0fdf4', label: '緑' },
  { value: '#fefce8', label: '黄' },
  { value: '#fef2f2', label: '赤' },
  { value: '#faf5ff', label: '紫' },
];

function createUniqueNodeId(nodes: MermaidNodeData[]): string {
  let index = nodes.length + 1;
  while (nodes.some((node) => node.id === `node_${index}`)) {
    index += 1;
  }
  return `node_${index}`;
}

function createUniqueEdgeId(edges: MermaidEdgeData[]): string {
  let index = edges.length + 1;
  while (edges.some((edge) => edge.id === `edge_${index}`)) {
    index += 1;
  }
  return `edge_${index}`;
}

export default function MermaidInspector({
  diagramData,
  selectedNodeId,
  selectedEdgeId,
  onChange,
  onSelectNode,
  onSelectEdge,
}: MermaidInspectorProps) {
  const [newEdgeSource, setNewEdgeSource] = useState<string>('');
  const [newEdgeTarget, setNewEdgeTarget] = useState<string>('');
  const [newEdgeLineType, setNewEdgeLineType] = useState<EdgeLineType>('arrow');
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>('');

  useEffect(() => {
    const nodes = diagramData.nodes;
    if (nodes.length === 0) {
      setNewEdgeSource('');
      setNewEdgeTarget('');
      return;
    }

    if (!nodes.some((n) => n.id === newEdgeSource)) {
      setNewEdgeSource(nodes[0].id);
    }

    if (!nodes.some((n) => n.id === newEdgeTarget)) {
      setNewEdgeTarget(nodes.length > 1 ? nodes[1].id : nodes[0].id);
    }
  }, [diagramData.nodes, newEdgeSource, newEdgeTarget]);

  const selectedNode =
    diagramData.nodes.find((node) => node.id === selectedNodeId) ?? null;

  const handleDirectionChange = (direction: MermaidDirection): void => {
    onChange({ ...diagramData, direction });
  };

  const handleAddNode = (): void => {
    const nextId = createUniqueNodeId(diagramData.nodes);
    const count = diagramData.nodes.length;
    const newNode: MermaidNodeData = {
      id: nextId,
      label: `要素 ${count + 1}`,
      shape: 'rect',
      color: '#ffffff',
      position: {
        x: (count % 3) * 200 + 80,
        y: Math.floor(count / 3) * 130 + 60,
      },
    };

    onChange({
      ...diagramData,
      nodes: [...diagramData.nodes, newNode],
    });
    onSelectEdge(null);
    onSelectNode(nextId);
  };

  const handleUpdateSelectedNode = (patch: Partial<MermaidNodeData>): void => {
    if (!selectedNode) {
      return;
    }
    const nextNodes = diagramData.nodes.map((node) =>
      node.id === selectedNode.id ? { ...node, ...patch } : node
    );
    onChange({ ...diagramData, nodes: nextNodes });
  };

  const handleDeleteSelectedNode = (): void => {
    if (!selectedNode) {
      return;
    }
    const nextNodes = diagramData.nodes.filter((node) => node.id !== selectedNode.id);
    const nextEdges = diagramData.edges.filter(
      (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
    );
    onChange({
      ...diagramData,
      nodes: nextNodes,
      edges: nextEdges,
    });
    onSelectNode(null);
  };

  const handleAddEdge = (): void => {
    if (!newEdgeSource || !newEdgeTarget) {
      return;
    }
    const nextEdge: MermaidEdgeData = {
      id: createUniqueEdgeId(diagramData.edges),
      source: newEdgeSource,
      target: newEdgeTarget,
      lineType: newEdgeLineType,
      label: newEdgeLabel.trim() || undefined,
    };
    onChange({
      ...diagramData,
      edges: [...diagramData.edges, nextEdge],
    });
    setNewEdgeLabel('');
    onSelectNode(null);
    onSelectEdge(nextEdge.id);
  };

  const handleUpdateEdge = (edgeId: string, patch: Partial<MermaidEdgeData>): void => {
    const nextEdges = diagramData.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, ...patch } : edge
    );
    onChange({ ...diagramData, edges: nextEdges });
  };

  const handleDeleteEdge = (edgeId: string): void => {
    const nextEdges = diagramData.edges.filter((edge) => edge.id !== edgeId);
    onChange({ ...diagramData, edges: nextEdges });
    if (selectedEdgeId === edgeId) {
      onSelectEdge(null);
    }
  };

  return (
    <aside className="inspector-panel">
      <section className="inspector-section">
        <h3 className="inspector-heading">図の向き設定</h3>
        <div className="direction-grid">
          {DIRECTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`inspector-choice-btn ${
                diagramData.direction === option.value ? 'is-active' : ''
              }`}
              onClick={() => handleDirectionChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-header">
          <h3 className="inspector-heading">要素の追加と編集</h3>
          <button type="button" className="btn-primary btn-sm" onClick={handleAddNode}>
            <Plus size={14} />
            <span>要素を追加</span>
          </button>
        </div>

        <label className="inspector-field">
          <span>編集対象の要素</span>
          <select
            value={selectedNodeId ?? ''}
            onChange={(event) => {
              const id = event.target.value || null;
              onSelectEdge(null);
              onSelectNode(id);
            }}
          >
            <option value="">要素を選択してください</option>
            {diagramData.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label} ({node.id})
              </option>
            ))}
          </select>
        </label>

        {selectedNode ? (
          <div className="node-edit-box">
            <label className="inspector-field">
              <span>ラベル名</span>
              <input
                type="text"
                value={selectedNode.label}
                onChange={(event) => handleUpdateSelectedNode({ label: event.target.value })}
                placeholder="要素のテキスト"
              />
            </label>

            <div className="inspector-field">
              <span>図形の形状</span>
              <div className="shape-btn-group">
                {SHAPE_OPTIONS.map((shape) => (
                  <button
                    key={shape.value}
                    type="button"
                    className={`inspector-choice-btn ${
                      selectedNode.shape === shape.value ? 'is-active' : ''
                    }`}
                    onClick={() => handleUpdateSelectedNode({ shape: shape.value })}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="inspector-field">
              <span>背景色</span>
              <div className="color-palette-row">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    title={color.label}
                    className={`color-swatch-btn ${
                      (selectedNode.color || '#ffffff') === color.value ? 'is-active' : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleUpdateSelectedNode({ color: color.value })}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn-danger btn-full"
              onClick={handleDeleteSelectedNode}
            >
              <Trash2 size={14} />
              <span>この要素を削除</span>
            </button>
          </div>
        ) : (
          <p className="inspector-hint">
            キャンバス上の図形をクリックするか、上のプルダウンから編集する要素を選んでください。
          </p>
        )}
      </section>

      <section className="inspector-section">
        <h3 className="inspector-heading">接続先のGUI設定</h3>

        <div className="edge-add-card">
          <div className="edge-add-grid">
            <label className="inspector-field">
              <span>接続元</span>
              <select
                value={newEdgeSource}
                onChange={(event) => setNewEdgeSource(event.target.value)}
                disabled={diagramData.nodes.length === 0}
              >
                {diagramData.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label} ({node.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>接続先</span>
              <select
                value={newEdgeTarget}
                onChange={(event) => setNewEdgeTarget(event.target.value)}
                disabled={diagramData.nodes.length === 0}
              >
                {diagramData.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label} ({node.id})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="edge-add-grid">
            <label className="inspector-field">
              <span>線の種類</span>
              <select
                value={newEdgeLineType}
                onChange={(event) => setNewEdgeLineType(event.target.value as EdgeLineType)}
              >
                {LINE_TYPE_OPTIONS.map((line) => (
                  <option key={line.value} value={line.value}>
                    {line.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>接続ラベル</span>
              <input
                type="text"
                value={newEdgeLabel}
                onChange={(event) => setNewEdgeLabel(event.target.value)}
                placeholder="任意 (例: はい)"
              />
            </label>
          </div>

          <button
            type="button"
            className="btn-primary btn-full"
            onClick={handleAddEdge}
            disabled={diagramData.nodes.length === 0}
          >
            <Plus size={14} />
            <span>接続を追加</span>
          </button>
        </div>

        <div className="edge-list-container">
          {diagramData.edges.length === 0 ? (
            <p className="inspector-hint">登録されている接続線はありません。</p>
          ) : (
            diagramData.edges.map((edge) => (
              <div
                key={edge.id}
                className={`edge-list-item ${edge.id === selectedEdgeId ? 'is-selected' : ''}`}
                onClick={() => {
                  onSelectNode(null);
                  onSelectEdge(edge.id);
                }}
              >
                <div className="edge-item-row">
                  <select
                    aria-label="接続元"
                    value={edge.source}
                    onChange={(event) =>
                      handleUpdateEdge(edge.id, { source: event.target.value })
                    }
                  >
                    {diagramData.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label} ({node.id})
                      </option>
                    ))}
                  </select>
                  <span className="edge-arrow-mark">→</span>
                  <select
                    aria-label="接続先"
                    value={edge.target}
                    onChange={(event) =>
                      handleUpdateEdge(edge.id, { target: event.target.value })
                    }
                  >
                    {diagramData.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label} ({node.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="edge-item-row">
                  <select
                    aria-label="線の種類"
                    value={edge.lineType}
                    onChange={(event) =>
                      handleUpdateEdge(edge.id, {
                        lineType: event.target.value as EdgeLineType,
                      })
                    }
                  >
                    {LINE_TYPE_OPTIONS.map((line) => (
                      <option key={line.value} value={line.value}>
                        {line.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    aria-label="接続ラベル"
                    value={edge.label ?? ''}
                    onChange={(event) =>
                      handleUpdateEdge(edge.id, {
                        label: event.target.value || undefined,
                      })
                    }
                    placeholder="ラベルなし"
                  />

                  <button
                    type="button"
                    className="btn-icon-danger"
                    title="この接続を削除"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteEdge(edge.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
