import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import '../styles/diagrams/common.css';
import { Check, X } from 'lucide-react';
import { useI18n } from '../i18n';
import type { MermaidDiagramType } from '../types/editor';
import { detectMermaidDiagramType } from '../utils/diagramDetect';
import { renderMermaidSvg } from '../utils/mermaidRender';
import {
  DIAGRAM_TYPE_OPTIONS,
  getCachedDiagramHandler,
  getDiagramRegistryEntry,
  isEditableDiagramType,
  loadDiagramHandler,
} from '../diagrams/registry';
import type {
  AnyDiagramData,
  DiagramStateCache,
  EditableDiagramType,
  ErasedDiagramHandler,
  WorkspaceRenderArgs,
} from '../diagrams/types';

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
  const [diagramType, setDiagramType] = useState<EditableDiagramType>('flowchart');
  const [diagramCache, setDiagramCache] = useState<DiagramStateCache>({});
  const [loadedHandlers, setLoadedHandlers] = useState<
    Partial<Record<EditableDiagramType, ErasedDiagramHandler>>
  >({});
  const [handlerLoadError, setHandlerLoadError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'preview' | 'code'>('preview');
  const [mobileView, setMobileView] = useState<'canvas' | 'inspector' | 'preview' | 'code'>(
    'canvas'
  );
  const [previewSvg, setPreviewSvg] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const diagramCacheRef = useRef<DiagramStateCache>(diagramCache);
  diagramCacheRef.current = diagramCache;
  const loadRequestIdRef = useRef(0);
  const prevRenderContextRef = useRef<{
    isOpen: boolean;
    diagramType: EditableDiagramType;
  }>({ isOpen: false, diagramType: 'flowchart' });

  useEffect(() => {
    if (!isOpen) {
      loadRequestIdRef.current += 1;
      return;
    }

    const detectedType = initialCode.trim()
      ? detectMermaidDiagramType(initialCode)
      : 'flowchart';
    const nextType: EditableDiagramType = isEditableDiagramType(detectedType)
      ? detectedType
      : 'flowchart';

    const requestId = ++loadRequestIdRef.current;
    let cancelled = false;

    setDiagramType(nextType);
    setBottomTab('preview');
    setMobileView('canvas');
    setHandlerLoadError(null);

    const applyOpenedHandler = (handler: ErasedDiagramHandler) => {
      const initialized = initialCode.trim()
        ? handler.parse(initialCode)
        : handler.createDefault(lang);
      const selection = handler.getInitialSelection(initialized);

      setLoadedHandlers((prev) =>
        prev[nextType] === handler ? prev : { ...prev, [nextType]: handler }
      );
      setDiagramCache({ [handler.storeKey]: initialized });
      setSelectedNodeId(selection.nodeId);
      setSelectedEdgeId(selection.edgeId);
    };

    const cachedHandler = getCachedDiagramHandler(nextType);
    if (cachedHandler) {
      applyOpenedHandler(cachedHandler);
      return;
    }

    setDiagramCache({});
    setSelectedNodeId(null);
    setSelectedEdgeId(null);

    void loadDiagramHandler(nextType)
      .then((handler) => {
        if (cancelled || loadRequestIdRef.current !== requestId) {
          return;
        }
        applyOpenedHandler(handler);
      })
      .catch((error) => {
        if (!cancelled && loadRequestIdRef.current === requestId) {
          setHandlerLoadError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialCode, lang]);

  const handleDiagramTypeChange = (rawNextType: MermaidDiagramType): void => {
    if (!isEditableDiagramType(rawNextType) || rawNextType === diagramType) {
      return;
    }

    const nextType = rawNextType;
    const prevType = diagramType;
    const requestId = ++loadRequestIdRef.current;

    setDiagramType(nextType);
    setHandlerLoadError(null);

    const applySwitchHandler = (nextHandler: ErasedDiagramHandler) => {
      setLoadedHandlers((prev) =>
        prev[nextType] === nextHandler ? prev : { ...prev, [nextType]: nextHandler }
      );

      const existingForStoreKey = diagramCacheRef.current[nextHandler.storeKey];
      if (nextHandler.transitionFromPrevious) {
        const transitioned = nextHandler.transitionFromPrevious({
          prevType,
          currentData: existingForStoreKey,
          initialCode,
          lang,
          t,
        });
        setDiagramCache((prev) => ({
          ...prev,
          [nextHandler.storeKey]: transitioned.data,
        }));
        setSelectedNodeId(transitioned.selection.nodeId);
        setSelectedEdgeId(transitioned.selection.edgeId);
        return;
      }

      const nextData = existingForStoreKey ?? nextHandler.createDefault(lang);
      if (!existingForStoreKey) {
        setDiagramCache((prev) => ({ ...prev, [nextHandler.storeKey]: nextData }));
      }
      const selection = nextHandler.getInitialSelection(nextData);
      setSelectedNodeId(selection.nodeId);
      setSelectedEdgeId(selection.edgeId);
    };

    const cachedHandler = loadedHandlers[nextType] ?? getCachedDiagramHandler(nextType);
    if (cachedHandler) {
      applySwitchHandler(cachedHandler);
      return;
    }

    void loadDiagramHandler(nextType)
      .then((handler) => {
        if (loadRequestIdRef.current !== requestId) {
          return;
        }
        applySwitchHandler(handler);
      })
      .catch((error) => {
        if (loadRequestIdRef.current === requestId) {
          setHandlerLoadError(error instanceof Error ? error.message : String(error));
        }
      });
  };

  const activeHandler =
    loadedHandlers[diagramType] ?? getCachedDiagramHandler(diagramType) ?? null;
  const activeEntry = getDiagramRegistryEntry(diagramType);
  const activeStoreKey = activeHandler?.storeKey ?? activeEntry.storeKey ?? null;
  const activeData = activeStoreKey ? diagramCache[activeStoreKey] : undefined;
  const isHandlerReady = activeHandler !== null && activeData !== undefined;

  const handleActiveDataChange = useCallback(
    (nextData: AnyDiagramData) => {
      if (!activeStoreKey) {
        return;
      }
      setDiagramCache((prev) => ({ ...prev, [activeStoreKey]: nextData }));
    },
    [activeStoreKey]
  );

  const generatedCode = useMemo(
    () => (activeHandler && activeData !== undefined ? activeHandler.generate(activeData) : ''),
    [activeHandler, activeData]
  );

  const isDiagramEmpty = useMemo(
    () => (activeHandler && activeData !== undefined ? activeHandler.isEmpty(activeData) : true),
    [activeHandler, activeData]
  );

  useEffect(() => {
    if (!isOpen || !isHandlerReady) {
      if (!isOpen) {
        prevRenderContextRef.current = { isOpen: false, diagramType };
      }
      return;
    }

    if (isDiagramEmpty) {
      prevRenderContextRef.current = { isOpen: true, diagramType };
      setPreviewSvg('');
      setPreviewError(null);
      return;
    }

    const isImmediate =
      !prevRenderContextRef.current.isOpen ||
      prevRenderContextRef.current.diagramType !== diagramType;
    prevRenderContextRef.current = { isOpen: true, diagramType };

    let cancelled = false;
    const renderId = `modal_mermaid_${reactId.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;

    const renderPreview = async (): Promise<void> => {
      const result = await renderMermaidSvg(renderId, generatedCode);
      if (!cancelled) {
        setPreviewSvg(result.svg);
        setPreviewError(result.error);
      }
    };

    if (isImmediate) {
      void renderPreview();
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      void renderPreview();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, isHandlerReady, diagramType, generatedCode, isDiagramEmpty, reactId]);

  if (!isOpen) {
    return null;
  }

  const workspaceArgs: WorkspaceRenderArgs<AnyDiagramData> | null =
    activeData !== undefined
      ? {
          data: activeData,
          selectedNodeId,
          selectedEdgeId,
          onChange: handleActiveDataChange,
          onSelectNode: setSelectedNodeId,
          onSelectEdge: setSelectedEdgeId,
        }
      : null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t.modal.ariaLabel}>
      <div className="mermaid-modal" data-mobile-view={mobileView}>
        <header className="modal-header">
          <div className="modal-title-group">
            <h2>{t.modal.title}</h2>
            <span className="modal-subtitle">{activeEntry.getSubtitle(t)}</span>
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
              disabled={!isHandlerReady}
              onClick={() => onApply(generatedCode)}
            >
              <Check size={15} />
              <span>{t.modal.apply}</span>
            </button>
          </div>
        </header>

        <div className="modal-mobile-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'canvas'}
            className={`modal-mobile-tab-btn ${mobileView === 'canvas' ? 'is-active' : ''}`}
            onClick={() => setMobileView('canvas')}
          >
            {t.modal.mobileTabCanvas}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'inspector'}
            className={`modal-mobile-tab-btn ${mobileView === 'inspector' ? 'is-active' : ''}`}
            onClick={() => setMobileView('inspector')}
          >
            {t.modal.mobileTabInspector}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'preview'}
            className={`modal-mobile-tab-btn ${mobileView === 'preview' ? 'is-active' : ''}`}
            onClick={() => {
              setMobileView('preview');
              setBottomTab('preview');
            }}
          >
            {t.modal.mobileTabPreview}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'code'}
            className={`modal-mobile-tab-btn ${mobileView === 'code' ? 'is-active' : ''}`}
            onClick={() => {
              setMobileView('code');
              setBottomTab('code');
            }}
          >
            {t.modal.mobileTabCode}
          </button>
        </div>

        <div className="modal-workspace">
          <div className="modal-canvas-pane">
            {handlerLoadError ? (
              <div className="mermaid-error-box">
                <pre>{handlerLoadError}</pre>
              </div>
            ) : isHandlerReady && workspaceArgs ? (
              activeHandler.renderCanvas(workspaceArgs)
            ) : (
              <div className="modal-diagram-loading" role="status" aria-live="polite">
                {t.modal.loadingDiagram}
              </div>
            )}
          </div>
          <div className="modal-inspector-pane">
            {isHandlerReady && workspaceArgs ? (
              activeHandler.renderInspector(workspaceArgs)
            ) : (
              <div className="modal-diagram-loading" role="status" aria-live="polite">
                {t.modal.loadingDiagram}
              </div>
            )}
          </div>
        </div>

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
