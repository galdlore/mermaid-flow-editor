import { useEffect, useId, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  ArchitectureDiagramData,
  GanttDiagramData,
  KanbanDiagramData,
  MermaidDiagramData,
  MermaidDiagramType,
  MindmapDiagramData,
  PieDiagramData,
  QuadrantDiagramData,
  TreeViewDiagramData,
  XYChartDiagramData,
} from '../types/editor';
import {
  createDefaultDiagramData,
  createDefaultSwimlaneData,
  detectMermaidDiagramType,
  generateMermaidCode,
  parseMermaidCodeToGuiData,
} from '../utils/mermaidConverter';
import {
  createDefaultTreeViewData,
  generateTreeViewCode,
  parseTreeViewCodeToGuiData,
} from '../utils/treeViewConverter';
import {
  createDefaultGanttData,
  generateGanttCode,
  parseGanttCodeToGuiData,
} from '../utils/ganttConverter';
import {
  createDefaultKanbanData,
  generateKanbanCode,
  parseKanbanCodeToGuiData,
} from '../utils/kanbanConverter';
import {
  createDefaultPieData,
  generatePieCode,
  parsePieCodeToGuiData,
} from '../utils/pieConverter';
import {
  createDefaultXYChartData,
  generateXYChartCode,
  parseXYChartCodeToGuiData,
} from '../utils/xychartConverter';
import {
  createDefaultArchitectureData,
  generateArchitectureCode,
  parseArchitectureCodeToGuiData,
} from '../utils/architectureConverter';
import {
  createDefaultMindmapData,
  generateMindmapCode,
  parseMindmapCodeToGuiData,
} from '../utils/mindmapConverter';
import {
  createDefaultQuadrantData,
  generateQuadrantCode,
  parseQuadrantCodeToGuiData,
} from '../utils/quadrantConverter';
import { renderMermaidSvg } from '../utils/mermaidRender';
import MermaidCanvas from './MermaidCanvas';
import MermaidInspector from './MermaidInspector';
import TreeViewCanvas from './TreeViewCanvas';
import TreeViewInspector from './TreeViewInspector';
import GanttCanvas from './GanttCanvas';
import GanttInspector from './GanttInspector';
import KanbanCanvas from './KanbanCanvas';
import KanbanInspector from './KanbanInspector';
import PieCanvas from './PieCanvas';
import PieInspector from './PieInspector';
import XYChartCanvas from './XYChartCanvas';
import XYChartInspector from './XYChartInspector';
import ArchitectureCanvas from './ArchitectureCanvas';
import ArchitectureInspector from './ArchitectureInspector';
import MindmapCanvas from './MindmapCanvas';
import MindmapInspector from './MindmapInspector';
import QuadrantCanvas from './QuadrantCanvas';
import QuadrantInspector from './QuadrantInspector';

const DIAGRAM_TYPE_OPTIONS: ReadonlyArray<{
  id: MermaidDiagramType;
  available: boolean;
}> = [
  { id: 'flowchart', available: true },
  { id: 'swimlane', available: true },
  { id: 'treeView', available: true },
  { id: 'gantt', available: true },
  { id: 'kanban', available: true },
  { id: 'pie', available: true },
  { id: 'xychart', available: true },
  { id: 'architecture', available: true },
  { id: 'mindmap', available: true },
  { id: 'quadrantChart', available: true },
  { id: 'sequence', available: false },
  { id: 'class', available: false },
  { id: 'state', available: false },
  { id: 'er', available: false },
];

export interface MermaidModalProps {
  isOpen: boolean;
  initialCode: string;
  onApply: (mermaidCode: string) => void;
  onClose: () => void;
}

export default function MermaidModal({
  isOpen,
  initialCode,
  onApply,
  onClose,
}: MermaidModalProps) {
  const { lang, t } = useI18n();
  const reactId = useId();
  const [diagramType, setDiagramType] = useState<MermaidDiagramType>('flowchart');
  const [diagramData, setDiagramData] = useState<MermaidDiagramData>(() =>
    createDefaultDiagramData(lang)
  );
  const [treeViewData, setTreeViewData] = useState<TreeViewDiagramData>(() =>
    createDefaultTreeViewData(lang)
  );
  const [ganttData, setGanttData] = useState<GanttDiagramData>(() =>
    createDefaultGanttData(lang)
  );
  const [kanbanData, setKanbanData] = useState<KanbanDiagramData>(() =>
    createDefaultKanbanData(lang)
  );
  const [pieData, setPieData] = useState<PieDiagramData>(() =>
    createDefaultPieData(lang)
  );
  const [xychartData, setXychartData] = useState<XYChartDiagramData>(() =>
    createDefaultXYChartData(lang)
  );
  const [architectureData, setArchitectureData] = useState<ArchitectureDiagramData>(() =>
    createDefaultArchitectureData(lang)
  );
  const [mindmapData, setMindmapData] = useState<MindmapDiagramData>(() =>
    createDefaultMindmapData(lang)
  );
  const [quadrantData, setQuadrantData] = useState<QuadrantDiagramData>(() =>
    createDefaultQuadrantData(lang)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'preview' | 'code'>('preview');
  const [previewSvg, setPreviewSvg] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const detectedType = initialCode.trim()
      ? detectMermaidDiagramType(initialCode)
      : 'flowchart';

    if (detectedType === 'treeView') {
      const parsedTree = parseTreeViewCodeToGuiData(initialCode);
      setDiagramType('treeView');
      setTreeViewData(parsedTree);
      setGanttData(createDefaultGanttData(lang));
      setKanbanData(createDefaultKanbanData(lang));
      setPieData(createDefaultPieData(lang));
      setXychartData(createDefaultXYChartData(lang));
      setArchitectureData(createDefaultArchitectureData(lang));
      setMindmapData(createDefaultMindmapData(lang));
      setQuadrantData(createDefaultQuadrantData(lang));
      setDiagramData(createDefaultDiagramData(lang));
      setSelectedNodeId(parsedTree.nodes[0]?.id ?? null);
      setSelectedEdgeId(null);
      setBottomTab('preview');
      return;
    }

    if (detectedType === 'gantt') {
      const parsedGantt = parseGanttCodeToGuiData(initialCode);
      setDiagramType('gantt');
      setGanttData(parsedGantt);
      setTreeViewData(createDefaultTreeViewData(lang));
      setKanbanData(createDefaultKanbanData(lang));
      setPieData(createDefaultPieData(lang));
      setXychartData(createDefaultXYChartData(lang));
      setArchitectureData(createDefaultArchitectureData(lang));
      setMindmapData(createDefaultMindmapData(lang));
      setQuadrantData(createDefaultQuadrantData(lang));
      setDiagramData(createDefaultDiagramData(lang));
      setSelectedNodeId(parsedGantt.tasks[0]?.id ?? null);
      setSelectedEdgeId(null);
      setBottomTab('preview');
      return;
    }

    if (detectedType === 'kanban') {
      const parsedKanban = parseKanbanCodeToGuiData(initialCode);
      setDiagramType('kanban');
      setKanbanData(parsedKanban);
      setTreeViewData(createDefaultTreeViewData(lang));
      setGanttData(createDefaultGanttData(lang));
      setPieData(createDefaultPieData(lang));
      setXychartData(createDefaultXYChartData(lang));
      setArchitectureData(createDefaultArchitectureData(lang));
      setMindmapData(createDefaultMindmapData(lang));
      setQuadrantData(createDefaultQuadrantData(lang));
      setDiagramData(createDefaultDiagramData(lang));
      setSelectedNodeId(parsedKanban.cards[0]?.id ?? null);
      setSelectedEdgeId(null);
      setBottomTab('preview');
      return;
    }

    if (detectedType === 'pie') {
      const parsedPie = parsePieCodeToGuiData(initialCode);
      setDiagramType('pie');
      setPieData(parsedPie);
      setTreeViewData(createDefaultTreeViewData(lang));
      setGanttData(createDefaultGanttData(lang));
      setKanbanData(createDefaultKanbanData(lang));
      setXychartData(createDefaultXYChartData(lang));
      setArchitectureData(createDefaultArchitectureData(lang));
      setMindmapData(createDefaultMindmapData(lang));
      setQuadrantData(createDefaultQuadrantData(lang));
      setDiagramData(createDefaultDiagramData(lang));
      setSelectedNodeId(parsedPie.slices[0]?.id ?? null);
      setSelectedEdgeId(null);
      setBottomTab('preview');
      return;
    }

    if (detectedType === 'xychart') {
      const parsedXY = parseXYChartCodeToGuiData(initialCode);
      setDiagramType('xychart');
      setXychartData(parsedXY);
      setTreeViewData(createDefaultTreeViewData(lang));
      setGanttData(createDefaultGanttData(lang));
      setKanbanData(createDefaultKanbanData(lang));
      setPieData(createDefaultPieData(lang));
      setArchitectureData(createDefaultArchitectureData(lang));
      setMindmapData(createDefaultMindmapData(lang));
      setQuadrantData(createDefaultQuadrantData(lang));
      setDiagramData(createDefaultDiagramData(lang));
      setSelectedNodeId(parsedXY.series[0]?.id ?? null);
      setSelectedEdgeId(null);
      setBottomTab('preview');
      return;
    }

    if (detectedType === 'architecture') {
      const parsedArch = parseArchitectureCodeToGuiData(initialCode);
      setDiagramType('architecture');
      setArchitectureData(parsedArch);
      setTreeViewData(createDefaultTreeViewData(lang));
      setGanttData(createDefaultGanttData(lang));
      setKanbanData(createDefaultKanbanData(lang));
      setPieData(createDefaultPieData(lang));
      setXychartData(createDefaultXYChartData(lang));
      setMindmapData(createDefaultMindmapData(lang));
      setQuadrantData(createDefaultQuadrantData(lang));
      setDiagramData(createDefaultDiagramData(lang));
      setSelectedNodeId(parsedArch.nodes[0]?.id ?? null);
      setSelectedEdgeId(parsedArch.edges[0]?.id ?? null);
      setBottomTab('preview');
      return;
    }

    if (detectedType === 'mindmap') {
      const parsedMindmap = parseMindmapCodeToGuiData(initialCode);
      setDiagramType('mindmap');
      setMindmapData(parsedMindmap);
      setTreeViewData(createDefaultTreeViewData(lang));
      setGanttData(createDefaultGanttData(lang));
      setKanbanData(createDefaultKanbanData(lang));
      setPieData(createDefaultPieData(lang));
      setXychartData(createDefaultXYChartData(lang));
      setArchitectureData(createDefaultArchitectureData(lang));
      setQuadrantData(createDefaultQuadrantData(lang));
      setDiagramData(createDefaultDiagramData(lang));
      setSelectedNodeId(parsedMindmap.nodes[0]?.id ?? null);
      setSelectedEdgeId(null);
      setBottomTab('preview');
      return;
    }

    if (detectedType === 'quadrantChart') {
      const parsedQuadrant = parseQuadrantCodeToGuiData(initialCode);
      setDiagramType('quadrantChart');
      setQuadrantData(parsedQuadrant);
      setTreeViewData(createDefaultTreeViewData(lang));
      setGanttData(createDefaultGanttData(lang));
      setKanbanData(createDefaultKanbanData(lang));
      setPieData(createDefaultPieData(lang));
      setXychartData(createDefaultXYChartData(lang));
      setArchitectureData(createDefaultArchitectureData(lang));
      setMindmapData(createDefaultMindmapData(lang));
      setDiagramData(createDefaultDiagramData(lang));
      setSelectedNodeId(parsedQuadrant.points[0]?.id ?? null);
      setSelectedEdgeId(null);
      setBottomTab('preview');
      return;
    }

    const initialized = initialCode.trim()
      ? parseMermaidCodeToGuiData(initialCode)
      : detectedType === 'swimlane'
        ? createDefaultSwimlaneData(lang)
        : createDefaultDiagramData(lang);

    setDiagramType(detectedType);
    setDiagramData(
      detectedType === 'swimlane'
        ? { ...initialized, diagramType: 'swimlane' }
        : initialized
    );
    setTreeViewData(createDefaultTreeViewData(lang));
    setGanttData(createDefaultGanttData(lang));
    setKanbanData(createDefaultKanbanData(lang));
    setPieData(createDefaultPieData(lang));
    setXychartData(createDefaultXYChartData(lang));
    setArchitectureData(createDefaultArchitectureData(lang));
    setMindmapData(createDefaultMindmapData(lang));
    setQuadrantData(createDefaultQuadrantData(lang));
    setSelectedNodeId(initialized.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    setBottomTab('preview');
  }, [isOpen, initialCode, lang]);

  const handleDiagramTypeChange = (nextType: MermaidDiagramType): void => {
    if (nextType === diagramType) {
      return;
    }

    const prevType = diagramType;
    setDiagramType(nextType);

    if (nextType === 'treeView') {
      setSelectedNodeId(treeViewData.nodes[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    if (nextType === 'gantt') {
      setSelectedNodeId(ganttData.tasks[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    if (nextType === 'kanban') {
      setSelectedNodeId(kanbanData.cards[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    if (nextType === 'pie') {
      setSelectedNodeId(pieData.slices[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    if (nextType === 'xychart') {
      setSelectedNodeId(xychartData.series[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    if (nextType === 'architecture') {
      setSelectedNodeId(architectureData.nodes[0]?.id ?? null);
      setSelectedEdgeId(architectureData.edges[0]?.id ?? null);
      return;
    }

    if (nextType === 'mindmap') {
      setSelectedNodeId(mindmapData.nodes[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    if (nextType === 'quadrantChart') {
      setSelectedNodeId(quadrantData.points[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    if (
      prevType === 'treeView' ||
      prevType === 'gantt' ||
      prevType === 'kanban' ||
      prevType === 'pie' ||
      prevType === 'xychart' ||
      prevType === 'architecture' ||
      prevType === 'mindmap' ||
      prevType === 'quadrantChart'
    ) {
      if (nextType === 'swimlane') {
        const nextSwimlane =
          (diagramData.subgraphs?.length ?? 0) > 0
            ? { ...diagramData, diagramType: 'swimlane' as const }
            : createDefaultSwimlaneData(lang);
        setDiagramData(nextSwimlane);
        setSelectedNodeId(nextSwimlane.nodes[0]?.id ?? null);
      } else {
        setDiagramData({ ...diagramData, diagramType: 'flowchart' });
        setSelectedNodeId(diagramData.nodes[0]?.id ?? null);
      }
      setSelectedEdgeId(null);
      return;
    }

    if (nextType === 'swimlane') {
      const isUntouchedFlowchart =
        !initialCode.trim() &&
        diagramData.nodes.length === 2 &&
        diagramData.nodes[0]?.id === 'node_1' &&
        diagramData.nodes[1]?.id === 'node_2' &&
        (!diagramData.subgraphs || diagramData.subgraphs.length === 0);

      if (isUntouchedFlowchart) {
        const nextSwimlane = createDefaultSwimlaneData(lang);
        setDiagramData(nextSwimlane);
        setSelectedNodeId(nextSwimlane.nodes[0]?.id ?? null);
        setSelectedEdgeId(null);
        return;
      }

      const existingSubgraphs = diagramData.subgraphs ?? [];
      if (existingSubgraphs.length === 0) {
        const fallbackLaneId = 'lane_1';
        setDiagramData({
          ...diagramData,
          diagramType: 'swimlane',
          subgraphs: [
            {
              id: fallbackLaneId,
              title: t.inspector.swimlane.defaultLaneTitle(1),
              fill: '#eff6ff',
              stroke: '#2563eb',
            },
          ],
          nodes: diagramData.nodes.map((node) => ({
            ...node,
            subgraphId: node.subgraphId || fallbackLaneId,
          })),
        });
      } else {
        setDiagramData({
          ...diagramData,
          diagramType: 'swimlane',
        });
      }
      return;
    }

    if (nextType === 'flowchart') {
      const isUntouchedSwimlane =
        !initialCode.trim() &&
        diagramData.nodes.length === 3 &&
        diagramData.nodes[2]?.id === 'node_3' &&
        diagramData.subgraphs?.length === 2 &&
        diagramData.subgraphs[0]?.id === 'lane_1';

      if (isUntouchedSwimlane) {
        const nextFlowchart = createDefaultDiagramData(lang);
        setDiagramData(nextFlowchart);
        setSelectedNodeId(nextFlowchart.nodes[0]?.id ?? null);
        setSelectedEdgeId(null);
        return;
      }

      setDiagramData({
        ...diagramData,
        diagramType: 'flowchart',
      });
    }
  };

  const generatedCode = useMemo(() => {
    if (diagramType === 'treeView') {
      return generateTreeViewCode(treeViewData);
    }
    if (diagramType === 'gantt') {
      return generateGanttCode(ganttData);
    }
    if (diagramType === 'kanban') {
      return generateKanbanCode(kanbanData);
    }
    if (diagramType === 'pie') {
      return generatePieCode(pieData);
    }
    if (diagramType === 'xychart') {
      return generateXYChartCode(xychartData);
    }
    if (diagramType === 'architecture') {
      return generateArchitectureCode(architectureData);
    }
    if (diagramType === 'mindmap') {
      return generateMindmapCode(mindmapData);
    }
    if (diagramType === 'quadrantChart') {
      return generateQuadrantCode(quadrantData);
    }
    return generateMermaidCode(diagramData);
  }, [diagramType, treeViewData, ganttData, kanbanData, pieData, xychartData, architectureData, mindmapData, quadrantData, diagramData]);

  const isDiagramEmpty =
    diagramType === 'treeView'
      ? treeViewData.nodes.length === 0
      : diagramType === 'gantt'
        ? ganttData.tasks.length === 0
        : diagramType === 'kanban'
          ? kanbanData.columns.length === 0
          : diagramType === 'pie'
            ? pieData.slices.length === 0
            : diagramType === 'xychart'
              ? xychartData.series.length === 0
              : diagramType === 'architecture'
                ? architectureData.nodes.length === 0
                : diagramType === 'mindmap'
                  ? mindmapData.nodes.length === 0
                  : diagramType === 'quadrantChart'
                    ? false
                    : diagramData.nodes.length === 0;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const renderId = `modal_mermaid_${reactId.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;

    const renderPreview = async (): Promise<void> => {
      if (isDiagramEmpty) {
        if (!cancelled) {
          setPreviewSvg('');
          setPreviewError(null);
        }
        return;
      }

      const result = await renderMermaidSvg(renderId, generatedCode);
      if (!cancelled) {
        setPreviewSvg(result.svg);
        setPreviewError(result.error);
      }
    };

    void renderPreview();

    return () => {
      cancelled = true;
    };
  }, [isOpen, generatedCode, isDiagramEmpty, reactId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t.modal.ariaLabel}>
      <div className="mermaid-modal">
        <header className="modal-header">
          <div className="modal-title-group">
            <h2>{t.modal.title}</h2>
            <span className="modal-subtitle">
              {diagramType === 'treeView'
                ? t.modal.subtitleTreeView
                : diagramType === 'gantt'
                  ? t.modal.subtitleGantt
                  : diagramType === 'kanban'
                    ? t.modal.subtitleKanban
                    : diagramType === 'pie'
                      ? t.modal.subtitlePie
                      : diagramType === 'xychart'
                        ? t.modal.subtitleXYChart
                        : diagramType === 'architecture'
                          ? t.modal.subtitleArchitecture
                          : diagramType === 'mindmap'
                            ? t.modal.subtitleMindmap
                            : diagramType === 'quadrantChart'
                              ? t.modal.subtitleQuadrantChart
                              : diagramType === 'swimlane'
                              ? t.modal.subtitleSwimlane
                              : t.modal.subtitle}
            </span>
          </div>
          <div className="modal-header-actions">
            <label className="modal-diagram-type-select-group">
              <span className="modal-diagram-type-label">{t.modal.diagramTypeLabel}</span>
              <select
                className="modal-diagram-type-select"
                aria-label={t.modal.diagramTypeLabel}
                value={diagramType}
                onChange={(event) =>
                  handleDiagramTypeChange(event.target.value as MermaidDiagramType)
                }
              >
                {DIAGRAM_TYPE_OPTIONS.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    disabled={!option.available}
                  >
                    {t.modal.diagramTypes[option.id]}
                    {!option.available ? ` (${t.modal.diagramTypeComingSoon})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-secondary" onClick={onClose}>
              <X size={15} />
              <span>{t.modal.cancel}</span>
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onApply(generatedCode)}
            >
              <Check size={15} />
              <span>{t.modal.apply}</span>
            </button>
          </div>
        </header>

        {(diagramType === 'flowchart' || diagramType === 'swimlane') && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <MermaidCanvas
                diagramData={diagramData}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onChange={setDiagramData}
                onSelectNode={setSelectedNodeId}
                onSelectEdge={setSelectedEdgeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <MermaidInspector
                diagramData={diagramData}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onChange={setDiagramData}
                onSelectNode={setSelectedNodeId}
                onSelectEdge={setSelectedEdgeId}
              />
            </div>
          </div>
        )}

        {diagramType === 'treeView' && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <TreeViewCanvas
                treeData={treeViewData}
                selectedNodeId={selectedNodeId}
                onChange={setTreeViewData}
                onSelectNode={setSelectedNodeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <TreeViewInspector
                treeData={treeViewData}
                selectedNodeId={selectedNodeId}
                onChange={setTreeViewData}
                onSelectNode={setSelectedNodeId}
              />
            </div>
          </div>
        )}

        {diagramType === 'gantt' && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <GanttCanvas
                ganttData={ganttData}
                selectedTaskId={selectedNodeId}
                onChange={setGanttData}
                onSelectTask={setSelectedNodeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <GanttInspector
                ganttData={ganttData}
                selectedTaskId={selectedNodeId}
                onChange={setGanttData}
                onSelectTask={setSelectedNodeId}
              />
            </div>
          </div>
        )}

        {diagramType === 'kanban' && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <KanbanCanvas
                kanbanData={kanbanData}
                selectedCardId={selectedNodeId}
                onChange={setKanbanData}
                onSelectCard={setSelectedNodeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <KanbanInspector
                kanbanData={kanbanData}
                selectedCardId={selectedNodeId}
                onChange={setKanbanData}
                onSelectCard={setSelectedNodeId}
              />
            </div>
          </div>
        )}

        {diagramType === 'pie' && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <PieCanvas
                pieData={pieData}
                selectedSliceId={selectedNodeId}
                onChange={setPieData}
                onSelectSlice={setSelectedNodeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <PieInspector
                pieData={pieData}
                selectedSliceId={selectedNodeId}
                onChange={setPieData}
                onSelectSlice={setSelectedNodeId}
              />
            </div>
          </div>
        )}

        {diagramType === 'xychart' && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <XYChartCanvas
                xychartData={xychartData}
                selectedSeriesId={selectedNodeId}
                onChange={setXychartData}
                onSelectSeries={setSelectedNodeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <XYChartInspector
                xychartData={xychartData}
                selectedSeriesId={selectedNodeId}
                onChange={setXychartData}
                onSelectSeries={setSelectedNodeId}
              />
            </div>
          </div>
        )}

        {diagramType === 'architecture' && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <ArchitectureCanvas
                architectureData={architectureData}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onChange={setArchitectureData}
                onSelectNode={setSelectedNodeId}
                onSelectEdge={setSelectedEdgeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <ArchitectureInspector
                architectureData={architectureData}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onChange={setArchitectureData}
                onSelectNode={setSelectedNodeId}
                onSelectEdge={setSelectedEdgeId}
              />
            </div>
          </div>
        )}

        {diagramType === 'mindmap' && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <MindmapCanvas
                mindmapData={mindmapData}
                selectedNodeId={selectedNodeId}
                onChange={setMindmapData}
                onSelectNode={setSelectedNodeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <MindmapInspector
                mindmapData={mindmapData}
                selectedNodeId={selectedNodeId}
                onChange={setMindmapData}
                onSelectNode={setSelectedNodeId}
              />
            </div>
          </div>
        )}

        {diagramType === 'quadrantChart' && (
          <div className="modal-workspace">
            <div className="modal-canvas-pane">
              <QuadrantCanvas
                data={quadrantData}
                selectedPointId={selectedNodeId}
                onChange={setQuadrantData}
                onSelectPoint={setSelectedNodeId}
              />
            </div>

            <div className="modal-inspector-pane">
              <QuadrantInspector
                data={quadrantData}
                selectedPointId={selectedNodeId}
                onChange={setQuadrantData}
                onSelectPoint={setSelectedNodeId}
              />
            </div>
          </div>
        )}

        <footer className="modal-bottom-panel">
          <div className="modal-bottom-tabs">
            <button
              type="button"
              className={`modal-tab-btn ${bottomTab === 'preview' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('preview')}
            >
              {t.modal.tabPreview}
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${bottomTab === 'code' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('code')}
            >
              {t.modal.tabCode}
            </button>
          </div>

          <div className="modal-bottom-content">
            {bottomTab === 'preview' ? (
              isDiagramEmpty ? (
                <div className="modal-empty-preview">{t.modal.emptyPreviewHint}</div>
              ) : previewError ? (
                <div className="mermaid-error-box">
                  <strong>{t.modal.previewErrorTitle}</strong>
                  <pre>{previewError}</pre>
                </div>
              ) : (
                <div
                  className="modal-preview-svg"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              )
            ) : (
              <pre className="modal-generated-code">{generatedCode}</pre>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
