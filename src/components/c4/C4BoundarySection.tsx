import { Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import { InspectorCollapsibleSection } from '../InspectorCollapsibleSection';
import { CommitIdInput } from '../InspectorCommon';
import {
  FORBIDDEN_C4_ID_CHARS_REGEX,
  FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX,
} from '../../utils/inputSafeguard';
import type { C4BoundaryData, C4BoundaryKind } from '../../types/editor';
import { C4_BOUNDARY_KIND_OPTIONS } from '../../utils/c4Converter';

export interface C4BoundarySectionProps {
  selectedBoundary: C4BoundaryData | null;
  selectableParentBoundaries: ReadonlyArray<C4BoundaryData>;
  isOpen: boolean;
  onToggle: () => void;
  onCommitBoundaryId: (rawNext: string) => string;
  onUpdateSelectedBoundary: (updater: (b: C4BoundaryData) => C4BoundaryData) => void;
  onDeleteSelectedBoundary: () => void;
}

export default function C4BoundarySection({
  selectedBoundary,
  selectableParentBoundaries,
  isOpen,
  onToggle,
  onCommitBoundaryId,
  onUpdateSelectedBoundary,
  onDeleteSelectedBoundary,
}: C4BoundarySectionProps) {
  const { t } = useI18n();
  const c4Text = t.inspector.c4Diagram;
  const safeguard = t.inspector.safeguard;

  return (
    <InspectorCollapsibleSection
      title={c4Text.boundarySection}
      badgeText={selectedBoundary?.id}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {!selectedBoundary ? (
        <p className="inspector-hint">{c4Text.selectBoundaryPrompt}</p>
      ) : (
        <>
          <CommitIdInput
            label={c4Text.boundaryIdField}
            value={selectedBoundary.id}
            forbiddenRegex={FORBIDDEN_C4_ID_CHARS_REGEX}
            formatError={safeguard.c4IdErrorChars}
            onCommit={onCommitBoundaryId}
          />

          <label className="inspector-field">
            <span>{c4Text.boundaryKindField}</span>
            <select
              value={selectedBoundary.kind}
              onChange={(e) => {
                const nextKind = e.target.value as C4BoundaryKind;
                onUpdateSelectedBoundary((b) => ({
                  ...b,
                  kind: nextKind,
                  ...(nextKind !== 'boundary' && nextKind !== 'node'
                    ? { boundaryType: undefined }
                    : {}),
                  ...(nextKind !== 'node' ? { descr: undefined } : {}),
                }));
              }}
            >
              {C4_BOUNDARY_KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {c4Text.boundaryKinds[k]}
                </option>
              ))}
            </select>
          </label>

          <label className="inspector-field">
            <span>{c4Text.boundaryParentField}</span>
            <select
              value={selectedBoundary.parentBoundaryId ?? ''}
              onChange={(e) =>
                onUpdateSelectedBoundary((b) => ({
                  ...b,
                  parentBoundaryId: e.target.value || undefined,
                }))
              }
            >
              <option value="">{c4Text.rootBoundaryOption}</option>
              {selectableParentBoundaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({b.id})
                </option>
              ))}
            </select>
          </label>

          <label className="inspector-field">
            <span>{c4Text.boundaryLabelField}</span>
            <GuardedInput
              value={selectedBoundary.label}
              placeholder={c4Text.boundaryLabelPlaceholder}
              forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
              formatError={safeguard.c4QuotedTextErrorChars}
              onChangeValue={(label) =>
                onUpdateSelectedBoundary((b) => ({ ...b, label }))
              }
            />
          </label>

          {(selectedBoundary.kind === 'boundary' ||
            selectedBoundary.kind === 'node') && (
            <label className="inspector-field">
              <span>{c4Text.boundaryTypeField}</span>
              <GuardedInput
                value={selectedBoundary.boundaryType ?? ''}
                placeholder={c4Text.boundaryTypePlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(val) =>
                  onUpdateSelectedBoundary((b) => ({
                    ...b,
                    boundaryType: val.trim() ? val : undefined,
                  }))
                }
              />
            </label>
          )}

          {selectedBoundary.kind === 'node' && (
            <label className="inspector-field">
              <span>{c4Text.boundaryDescrField}</span>
              <GuardedInput
                value={selectedBoundary.descr ?? ''}
                placeholder={c4Text.boundaryDescrPlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(val) =>
                  onUpdateSelectedBoundary((b) => ({
                    ...b,
                    descr: val.trim() ? val : undefined,
                  }))
                }
              />
            </label>
          )}

          <button
            type="button"
            className="btn-danger-outline"
            onClick={onDeleteSelectedBoundary}
          >
            <Trash2 size={14} />
            <span>{c4Text.deleteBoundaryBtn}</span>
          </button>
        </>
      )}
    </InspectorCollapsibleSection>
  );
}
