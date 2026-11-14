import { useEffect, useId, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useI18n } from '../i18n';
import type { MermaidDiagramData } from '../types/editor';
import {
  createDefaultDiagramData,
  generateMermaidCode,
  parseMermaidCodeToGuiData,
} from '../utils/mermaidConverter';
import { renderMermaidSvg } from '../utils/mermaidRender';
import MermaidCanvas from './MermaidCanvas';
import MermaidInspector from './MermaidInspector';

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
  const [diagramData, setDiagramData] = useState<MermaidDiagramData>(() =>
    createDefaultDiagramData(lang)
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

    const initialized = initialCode.trim()
      ? parseMermaidCodeToGuiData(initialCode)
      : createDefaultDiagramData(lang);

    setDiagramData(initialized);
    setSelectedNodeId(initialized.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    setBottomTab('preview');
  }, [isOpen, initialCode, lang]);

  const generatedCode = useMemo(
    () => generateMermaidCode(diagramData),
    [diagramData]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const renderId = `modal_mermaid_${reactId.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;

    const renderPreview = async (): Promise<void> => {
      if (diagramData.nodes.length === 0) {
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
  }, [isOpen, generatedCode, diagramData.nodes.length, reactId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t.modal.ariaLabel}>
      <div className="mermaid-modal">
        <header className="modal-header">
          <div className="modal-title-group">
            <h2>{t.modal.title}</h2>
            <span className="modal-subtitle">{t.modal.subtitle}</span>
          </div>
          <div className="modal-header-actions">
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
              diagramData.nodes.length === 0 ? (
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
