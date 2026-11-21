import { Info } from 'lucide-react';
import { useI18n } from '../i18n';
import type { InfoDiagramData } from '../types/editor';

export interface InfoCanvasProps {
  infoData: InfoDiagramData;
}

export default function InfoCanvas({ infoData }: InfoCanvasProps) {
  const { t } = useI18n();
  const inf = t.inspector.info;

  return (
    <div className="info-canvas">
      <div className="systems-canvas-scroll">
        <div className="info-card-preview">
          <div className="info-card-badge">
            <Info size={13} style={{ marginRight: 5 }} />
            <span>
              {infoData.showInfo
                ? inf.previewEnabledLabel
                : inf.previewDisabledLabel}
            </span>
          </div>
          <div className="info-card-version">{inf.previewCardHeading}</div>
          {infoData.title && (
            <div className="info-card-meta">
              {inf.titleField}: {infoData.title}
            </div>
          )}
          {infoData.accTitle && (
            <div className="info-card-meta">
              {inf.accTitleField}: {infoData.accTitle}
            </div>
          )}
          {infoData.accDescr && (
            <div className="info-card-meta">
              {inf.accDescrField}: {infoData.accDescr}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
