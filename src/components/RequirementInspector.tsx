import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX } from '../utils/inputSafeguard';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import {
  REQUIREMENT_DIRECTION_OPTIONS,
  REQUIREMENT_KIND_OPTIONS,
  REQUIREMENT_RELATION_OPTIONS,
  REQUIREMENT_RISK_OPTIONS,
  REQUIREMENT_VERIFY_OPTIONS,
} from '../utils/requirementConverter';
import type {
  RequirementDiagramData,
  RequirementDirection,
  RequirementElementData,
  RequirementKind,
  RequirementNodeData,
  RequirementRelationData,
  RequirementRelationType,
  RequirementRisk,
  RequirementVerifyMethod,
} from '../types/editor';

export interface RequirementInspectorProps {
  requirementData: RequirementDiagramData;
  selectedItemId: string | null;
  onChange: (next: RequirementDiagramData) => void;
  onSelectItem: (id: string | null) => void;
}

type ReqSectionKey = 'item' | 'relations' | 'settings' | 'comments';

export default function RequirementInspector({
  requirementData,
  selectedItemId,
  onChange,
  onSelectItem,
}: RequirementInspectorProps) {
  const { t } = useI18n();
  const rq = t.inspector.requirement;
  const safeguard = t.inspector.safeguard;

  const selectedReq =
    requirementData.requirements.find((r) => r.id === selectedItemId) ?? null;
  const selectedEl =
    requirementData.elements.find((e) => e.id === selectedItemId) ?? null;

  const [openSections, setOpenSections] = useState<
    Record<ReqSectionKey, boolean>
  >({
    item: true,
    relations: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedItemId) {
      setOpenSections((prev) => (prev.item ? prev : { ...prev, item: true }));
    }
  }, [selectedItemId]);

  const toggleSection = (key: ReqSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      item: open,
      relations: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const allEndpoints = [
    ...requirementData.requirements.map((r) => ({ id: r.id, name: r.name })),
    ...requirementData.elements.map((e) => ({ id: e.id, name: e.name })),
  ];

  const updateReq = (patch: Partial<RequirementNodeData>): void => {
    if (!selectedReq) return;
    onChange({
      ...requirementData,
      requirements: requirementData.requirements.map((r) =>
        r.id === selectedReq.id ? { ...r, ...patch } : r
      ),
    });
  };

  const updateEl = (patch: Partial<RequirementElementData>): void => {
    if (!selectedEl) return;
    onChange({
      ...requirementData,
      elements: requirementData.elements.map((e) =>
        e.id === selectedEl.id ? { ...e, ...patch } : e
      ),
    });
  };

  const handleDeleteSelected = (): void => {
    if (selectedReq) {
      const nextReqs = requirementData.requirements.filter(
        (r) => r.id !== selectedReq.id
      );
      const nextRels = requirementData.relations.filter(
        (rel) => rel.sourceId !== selectedReq.id && rel.targetId !== selectedReq.id
      );
      onChange({
        ...requirementData,
        requirements: nextReqs,
        relations: nextRels,
      });
      onSelectItem(nextReqs[0]?.id ?? requirementData.elements[0]?.id ?? null);
    } else if (selectedEl) {
      const nextEls = requirementData.elements.filter(
        (e) => e.id !== selectedEl.id
      );
      const nextRels = requirementData.relations.filter(
        (rel) => rel.sourceId !== selectedEl.id && rel.targetId !== selectedEl.id
      );
      onChange({
        ...requirementData,
        elements: nextEls,
        relations: nextRels,
      });
      onSelectItem(requirementData.requirements[0]?.id ?? nextEls[0]?.id ?? null);
    }
  };

  const handleAddRelation = (): void => {
    if (allEndpoints.length < 2) return;
    const usedIds = new Set(requirementData.relations.map((r) => r.id));
    const id = allocateUniqueId(
      `rrel_${requirementData.relations.length + 1}`,
      usedIds
    );
    onChange({
      ...requirementData,
      relations: [
        ...requirementData.relations,
        {
          id,
          sourceId: allEndpoints[0].id,
          targetId: allEndpoints[1].id,
          type: 'satisfies',
        },
      ],
    });
  };

  const updateRelation = (
    id: string,
    patch: Partial<RequirementRelationData>
  ): void => {
    onChange({
      ...requirementData,
      relations: requirementData.relations.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    });
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={rq.itemSection}
        isOpen={openSections.item}
        onToggle={() => toggleSection('item')}
      >
        {selectedReq ? (
          <>
            <div className="inspector-role-badge">{rq.reqBadge}</div>
            <label className="inspector-field">
              <span>{rq.reqNameField}</span>
              <GuardedInput
                value={selectedReq.name}
                placeholder={rq.reqNamePlaceholder}
                forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
                formatError={safeguard.requirementTextErrorChars}
                onChangeValue={(name) => updateReq({ name })}
              />
            </label>

            <label className="inspector-field">
              <span>{rq.reqKindField}</span>
              <select
                value={selectedReq.kind}
                onChange={(e) =>
                  updateReq({ kind: e.target.value as RequirementKind })
                }
              >
                {REQUIREMENT_KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {rq.reqKinds[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{rq.reqIdField}</span>
              <GuardedInput
                value={selectedReq.reqId}
                placeholder={rq.reqIdPlaceholder}
                forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
                formatError={safeguard.requirementTextErrorChars}
                onChangeValue={(reqId) => updateReq({ reqId })}
              />
            </label>

            <label className="inspector-field">
              <span>{rq.reqTextField}</span>
              <GuardedInput
                value={selectedReq.text}
                placeholder={rq.reqTextPlaceholder}
                forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
                formatError={safeguard.requirementTextErrorChars}
                onChangeValue={(text) => updateReq({ text })}
              />
            </label>

            <label className="inspector-field">
              <span>{rq.riskField}</span>
              <select
                value={selectedReq.risk}
                onChange={(e) =>
                  updateReq({ risk: e.target.value as RequirementRisk })
                }
              >
                {REQUIREMENT_RISK_OPTIONS.map((rk) => (
                  <option key={rk} value={rk}>
                    {rq.risks[rk]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{rq.verifyMethodField}</span>
              <select
                value={selectedReq.verifyMethod}
                onChange={(e) =>
                  updateReq({
                    verifyMethod: e.target.value as RequirementVerifyMethod,
                  })
                }
              >
                {REQUIREMENT_VERIFY_OPTIONS.map((vm) => (
                  <option key={vm} value={vm}>
                    {rq.verifyMethods[vm]}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelected}
            >
              <Trash2 size={14} />
              <span>{rq.deleteReqBtn}</span>
            </button>
          </>
        ) : selectedEl ? (
          <>
            <div className="inspector-role-badge">{rq.elementBadge}</div>
            <label className="inspector-field">
              <span>{rq.elementNameField}</span>
              <GuardedInput
                value={selectedEl.name}
                placeholder={rq.elementNamePlaceholder}
                forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
                formatError={safeguard.requirementTextErrorChars}
                onChangeValue={(name) => updateEl({ name })}
              />
            </label>

            <label className="inspector-field">
              <span>{rq.elementTypeField}</span>
              <GuardedInput
                value={selectedEl.type}
                placeholder={rq.elementTypePlaceholder}
                forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
                formatError={safeguard.requirementTextErrorChars}
                onChangeValue={(type) => updateEl({ type })}
              />
            </label>

            <label className="inspector-field">
              <span>{rq.docrefField}</span>
              <GuardedInput
                value={selectedEl.docref}
                placeholder={rq.docrefPlaceholder}
                forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
                formatError={safeguard.requirementTextErrorChars}
                onChangeValue={(docref) => updateEl({ docref })}
              />
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelected}
            >
              <Trash2 size={14} />
              <span>{rq.deleteElementBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{rq.selectItemPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={rq.relationsSection}
        isOpen={openSections.relations}
        onToggle={() => toggleSection('relations')}
      >
        <div className="timeline-events-heading-row">
          <span />
          <button
            type="button"
            className="btn-secondary btn-xs"
            disabled={allEndpoints.length < 2}
            onClick={handleAddRelation}
          >
            <Plus size={12} />
            <span>{rq.addRelationBtn}</span>
          </button>
        </div>
        {requirementData.relations.length === 0 ? (
          <p className="inspector-hint">{rq.emptyRelations}</p>
        ) : (
          <div className="timeline-events-editor">
            {requirementData.relations.map((rel) => (
              <div key={rel.id} className="inspector-list-card">
                <label className="inspector-field">
                  <span>{rq.relationSourceField}</span>
                  <select
                    value={rel.sourceId}
                    onChange={(e) =>
                      updateRelation(rel.id, { sourceId: e.target.value })
                    }
                  >
                    {allEndpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-field">
                  <span>{rq.relationTypeField}</span>
                  <select
                    value={rel.type}
                    onChange={(e) =>
                      updateRelation(rel.id, {
                        type: e.target.value as RequirementRelationType,
                      })
                    }
                  >
                    {REQUIREMENT_RELATION_OPTIONS.map((rt) => (
                      <option key={rt} value={rt}>
                        {rq.relationTypes[rt]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-field">
                  <span>{rq.relationTargetField}</span>
                  <select
                    value={rel.targetId}
                    onChange={(e) =>
                      updateRelation(rel.id, { targetId: e.target.value })
                    }
                  >
                    {allEndpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="btn-icon-subtle is-danger"
                  title={rq.deleteRelationTitle}
                  onClick={() =>
                    onChange({
                      ...requirementData,
                      relations: requirementData.relations.filter(
                        (r) => r.id !== rel.id
                      ),
                    })
                  }
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={rq.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{rq.directionField}</span>
          <select
            value={requirementData.direction ?? 'TB'}
            onChange={(e) =>
              onChange({
                ...requirementData,
                direction: e.target.value as RequirementDirection,
              })
            }
          >
            {REQUIREMENT_DIRECTION_OPTIONS.map((dir) => (
              <option key={dir} value={dir}>
                {rq.directions[dir]}
              </option>
            ))}
          </select>
        </label>

        <label className="inspector-field">
          <span>{rq.titleField}</span>
          <GuardedInput
            value={requirementData.title ?? ''}
            placeholder={rq.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
            formatError={safeguard.requirementTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...requirementData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={rq.commentsSection}
        fieldLabel={rq.commentsField}
        placeholder={rq.commentsPlaceholder}
        comments={requirementData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) =>
          onChange({ ...requirementData, comments })
        }
      />
    </div>
  );
}
