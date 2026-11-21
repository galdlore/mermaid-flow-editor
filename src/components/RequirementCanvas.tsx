import { GitBranch, Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import type { RequirementDiagramData } from '../types/editor';

export interface RequirementCanvasProps {
  requirementData: RequirementDiagramData;
  selectedItemId: string | null;
  onChange: (next: RequirementDiagramData) => void;
  onSelectItem: (id: string | null) => void;
}

export default function RequirementCanvas({
  requirementData,
  selectedItemId,
  onChange,
  onSelectItem,
}: RequirementCanvasProps) {
  const { t } = useI18n();
  const rq = t.inspector.requirement;

  const allNodes = [
    ...requirementData.requirements.map((r) => ({ id: r.id, name: r.name })),
    ...requirementData.elements.map((e) => ({ id: e.id, name: e.name })),
  ];
  const nameById = new Map(allNodes.map((n) => [n.id, n.name]));

  const handleAddRequirement = (): void => {
    const usedIds = new Set([
      ...requirementData.requirements.map((r) => r.id),
      ...requirementData.elements.map((e) => e.id),
    ]);
    const id = allocateUniqueId(
      `req_${requirementData.requirements.length + 1}`,
      usedIds
    );
    const num = requirementData.requirements.length + 1;
    onChange({
      ...requirementData,
      requirements: [
        ...requirementData.requirements,
        {
          id,
          name: rq.defaultReqName(num),
          kind: 'functionalRequirement',
          reqId: `REQ-${num}`,
          text: rq.defaultReqName(num),
          risk: 'medium',
          verifyMethod: 'test',
        },
      ],
    });
    onSelectItem(id);
  };

  const handleAddElement = (): void => {
    const usedIds = new Set([
      ...requirementData.requirements.map((r) => r.id),
      ...requirementData.elements.map((e) => e.id),
    ]);
    const id = allocateUniqueId(
      `el_${requirementData.elements.length + 1}`,
      usedIds
    );
    const num = requirementData.elements.length + 1;
    onChange({
      ...requirementData,
      elements: [
        ...requirementData.elements,
        {
          id,
          name: rq.defaultElementName(num),
          type: 'Service',
          docref: 'spec.md',
        },
      ],
    });
    onSelectItem(id);
  };

  const handleAddRelation = (): void => {
    if (allNodes.length < 2) return;
    const usedIds = new Set(requirementData.relations.map((r) => r.id));
    const id = allocateUniqueId(
      `rrel_${requirementData.relations.length + 1}`,
      usedIds
    );
    const sourceId =
      selectedItemId && nameById.has(selectedItemId)
        ? selectedItemId
        : allNodes[0].id;
    const target = allNodes.find((n) => n.id !== sourceId) ?? allNodes[1];
    onChange({
      ...requirementData,
      relations: [
        ...requirementData.relations,
        {
          id,
          sourceId,
          targetId: target.id,
          type: 'satisfies',
        },
      ],
    });
  };

  return (
    <div className="requirement-canvas">
      <div className="systems-toolbar">
        <button
          type="button"
          className="btn-primary btn-xs"
          onClick={handleAddRequirement}
        >
          <Plus size={13} />
          <span>{rq.addReqBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleAddElement}
        >
          <Plus size={13} />
          <span>{rq.addElementBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={allNodes.length < 2}
          onClick={handleAddRelation}
        >
          <GitBranch size={13} />
          <span>{rq.addRelationBtn}</span>
        </button>
      </div>

      <div className="systems-canvas-scroll">
        {requirementData.title && (
          <div className="systems-title-banner">{requirementData.title}</div>
        )}

        {allNodes.length === 0 ? (
          <div className="systems-empty-state">{rq.emptyItems}</div>
        ) : (
          <>
            {requirementData.requirements.length > 0 && (
              <>
                <div className="systems-section-heading">{rq.reqBadge}</div>
                <div className="requirement-grid">
                  {requirementData.requirements.map((req) => (
                    <button
                      key={req.id}
                      type="button"
                      className={`requirement-card ${
                        selectedItemId === req.id ? 'is-selected' : ''
                      }`}
                      onClick={() => onSelectItem(req.id)}
                    >
                      <div className="requirement-card-head">
                        <span className="requirement-kind-tag">
                          {req.reqId} · {req.kind}
                        </span>
                        <span
                          className="requirement-risk-pill"
                          data-risk={req.risk}
                        >
                          {req.risk}
                        </span>
                      </div>
                      <div className="requirement-card-name">{req.name}</div>
                      <div className="requirement-card-meta">{req.text}</div>
                      <div className="requirement-card-meta">
                        {rq.verifyMethodField}: {req.verifyMethod}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {requirementData.elements.length > 0 && (
              <>
                <div className="systems-section-heading">{rq.elementBadge}</div>
                <div className="requirement-grid">
                  {requirementData.elements.map((el) => (
                    <button
                      key={el.id}
                      type="button"
                      className={`requirement-card is-element ${
                        selectedItemId === el.id ? 'is-selected' : ''
                      }`}
                      onClick={() => onSelectItem(el.id)}
                    >
                      <div className="requirement-card-head">
                        <span className="requirement-kind-tag">{rq.elementBadge}</span>
                        <span className="requirement-kind-tag">{el.type}</span>
                      </div>
                      <div className="requirement-card-name">{el.name}</div>
                      <div className="requirement-card-meta">{el.docref}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {requirementData.relations.length > 0 && (
              <>
                <div className="systems-section-heading">
                  {rq.relationsSection}
                </div>
                <div className="requirement-relations-bar">
                  {requirementData.relations.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      className="requirement-rel-chip"
                      onClick={() => onSelectItem(rel.sourceId)}
                    >
                      {nameById.get(rel.sourceId) ?? rel.sourceId} — [{rel.type}] →{' '}
                      {nameById.get(rel.targetId) ?? rel.targetId}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
