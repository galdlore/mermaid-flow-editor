import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatEventModelingFrameNumber } from '../utils/eventModelingConverter';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import type { EventModelingDiagramData } from '../types/editor';

export interface EventModelingCanvasProps {
  eventModelingData: EventModelingDiagramData;
  selectedFrameId: string | null;
  onChange: (next: EventModelingDiagramData) => void;
  onSelectFrame: (frameId: string | null) => void;
}

const SWIMLANE_BANDS = [
  { key: 'top', label: 'UI / Processor', types: new Set(['ui', 'pcr']) },
  { key: 'mid', label: 'Command / ReadModel', types: new Set(['cmd', 'rmo']) },
  { key: 'bot', label: 'Events', types: new Set(['evt']) },
] as const;

export default function EventModelingCanvas({
  eventModelingData,
  selectedFrameId,
  onChange,
  onSelectFrame,
}: EventModelingCanvasProps) {
  const { t } = useI18n();
  const em = t.inspector.eventmodeling;

  const notedFrames = new Set(
    (eventModelingData.notes ?? []).map((n) => n.frameNumber)
  );

  const handleAddFrame = (): void => {
    const usedIds = new Set(eventModelingData.frames.map((f) => f.id));
    const usedNums = new Set(eventModelingData.frames.map((f) => f.frameNumber));
    const id = allocateUniqueId(
      `em_${eventModelingData.frames.length + 1}`,
      usedIds
    );
    let seq = eventModelingData.frames.length + 1;
    let num = formatEventModelingFrameNumber('', seq - 1);
    while (usedNums.has(num)) {
      num = formatEventModelingFrameNumber('', seq++);
    }
    const prevNum =
      eventModelingData.frames[eventModelingData.frames.length - 1]?.frameNumber;
    onChange({
      ...eventModelingData,
      frames: [
        ...eventModelingData.frames,
        {
          id,
          frameKind: 'tf',
          frameNumber: num,
          entityType: 'evt',
          namespace: 'Domain',
          entityName: `Event${num}`,
          sourceFrames: prevNum ? [prevNum] : [],
        },
      ],
    });
    onSelectFrame(id);
  };

  return (
    <div className="eventmodeling-canvas">
      <div className="systems-toolbar">
        <button
          type="button"
          className="btn-primary btn-xs"
          onClick={handleAddFrame}
        >
          <Plus size={13} />
          <span>{em.addFrameBtn}</span>
        </button>
      </div>

      <div className="systems-canvas-scroll">
        {eventModelingData.title && (
          <div className="systems-title-banner">{eventModelingData.title}</div>
        )}

        {eventModelingData.frames.length === 0 ? (
          <div className="systems-empty-state">{em.emptyFrames}</div>
        ) : (
          <div className="em-board">
            {SWIMLANE_BANDS.map((band) => {
              const bandFrames = eventModelingData.frames.filter((f) =>
                band.types.has(f.entityType)
              );
              return (
                <div key={band.key} className="em-lane-row">
                  <div className="em-lane-label">{band.label}</div>
                  <div className="em-lane-cards">
                    {bandFrames.map((frame) => {
                      const qname = frame.namespace
                        ? `${frame.namespace}.${frame.entityName}`
                        : frame.entityName;
                      return (
                        <button
                          key={frame.id}
                          type="button"
                          data-etype={frame.entityType}
                          className={`em-frame-card ${
                            selectedFrameId === frame.id ? 'is-selected' : ''
                          }`}
                          onClick={() => onSelectFrame(frame.id)}
                        >
                          <div className="em-frame-top">
                            <span>
                              {frame.frameKind} {frame.frameNumber}
                            </span>
                            <span>{frame.entityType.toUpperCase()}</span>
                          </div>
                          <div className="em-frame-title">{qname}</div>
                          {(frame.sourceFrames.length > 0 ||
                            frame.dataRef ||
                            notedFrames.has(frame.frameNumber)) && (
                            <div className="em-frame-sub">
                              {frame.sourceFrames.length > 0 &&
                                `->> ${frame.sourceFrames.join(',')} `}
                              {frame.dataRef && `[[${frame.dataRef}]] `}
                              {notedFrames.has(frame.frameNumber) && '[note]'}
                            </div>
                          )}
                          {frame.inlineData && (
                            <div className="em-frame-sub">{frame.inlineData}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
