import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import {
  InspectorCollapsibleSection,
  STROKE_COLOR_PALETTE_ITEMS,
} from '../InspectorCollapsibleSection';
import { CommitIdInput, InspectorColorPalette } from '../InspectorCommon';
import {
  FORBIDDEN_C4_ID_CHARS_REGEX,
  FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX,
} from '../../utils/inputSafeguard';
import type {
  C4BoundaryData,
  C4ElementData,
  C4ElementKind,
  C4ElementVariant,
} from '../../types/editor';
import {
  C4_ELEMENT_KIND_OPTIONS,
  C4_ELEMENT_VARIANT_OPTIONS,
} from '../../utils/c4Converter';

export interface C4ElementSectionProps {
  selectedElement: C4ElementData | null;
  boundaries: ReadonlyArray<C4BoundaryData>;
  isOpen: boolean;
  onToggle: () => void;
  onQuickAddRelation: () => void;
  onCommitElementId: (rawNext: string) => string;
  onUpdateSelectedElement: (updater: (el: C4ElementData) => C4ElementData) => void;
  onDeleteSelectedElement: () => void;
}

export default function C4ElementSection({
  selectedElement,
  boundaries,
  isOpen,
  onToggle,
  onQuickAddRelation,
  onCommitElementId,
  onUpdateSelectedElement,
  onDeleteSelectedElement,
}: C4ElementSectionProps) {
  const { t } = useI18n();
  const c4Text = t.inspector.c4Diagram;
  const safeguard = t.inspector.safeguard;

  return (
    <InspectorCollapsibleSection
      title={c4Text.elementSection}
      badgeText={selectedElement?.id}
      isOpen={isOpen}
      onToggle={onToggle}
      headerAction={
        selectedElement ? (
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={onQuickAddRelation}
          >
            <Plus size={12} />
            <span>{c4Text.addRelationBtn}</span>
          </button>
        ) : undefined
      }
    >
      {!selectedElement ? (
        <p className="inspector-hint">{c4Text.selectElementPrompt}</p>
      ) : (
        <>
          <CommitIdInput
            label={c4Text.elementIdField}
            value={selectedElement.id}
            forbiddenRegex={FORBIDDEN_C4_ID_CHARS_REGEX}
            formatError={safeguard.c4IdErrorChars}
            onCommit={onCommitElementId}
          />

          <label className="inspector-field">
            <span>{c4Text.elementKindField}</span>
            <select
              value={selectedElement.kind}
              onChange={(e) => {
                const nextKind = e.target.value as C4ElementKind;
                onUpdateSelectedElement((el) => ({
                  ...el,
                  kind: nextKind,
                  ...(nextKind === 'person' ? { variant: undefined } : {}),
                  ...(nextKind !== 'container' && nextKind !== 'component'
                    ? { techn: undefined }
                    : {}),
                }));
              }}
            >
              {C4_ELEMENT_KIND_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {c4Text.elementKinds[kind]}
                </option>
              ))}
            </select>
          </label>

          {selectedElement.kind !== 'person' && (
            <label className="inspector-field">
              <span>{c4Text.elementVariantField}</span>
              <select
                value={selectedElement.variant ?? 'standard'}
                onChange={(e) => {
                  const nextVar = e.target.value as C4ElementVariant;
                  onUpdateSelectedElement((el) => ({
                    ...el,
                    variant: nextVar === 'standard' ? undefined : nextVar,
                  }));
                }}
              >
                {C4_ELEMENT_VARIANT_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {c4Text.elementVariants[v]}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="checkbox-field-label">
            <input
              type="checkbox"
              checked={Boolean(selectedElement.external)}
              onChange={(e) =>
                onUpdateSelectedElement((el) => ({
                  ...el,
                  external: e.target.checked ? true : undefined,
                }))
              }
            />
            <span>{c4Text.elementExternalField}</span>
          </label>

          <label className="inspector-field">
            <span>{c4Text.elementParentBoundaryField}</span>
            <select
              value={selectedElement.boundaryId ?? ''}
              onChange={(e) =>
                onUpdateSelectedElement((el) => ({
                  ...el,
                  boundaryId: e.target.value || undefined,
                }))
              }
            >
              <option value="">{c4Text.rootBoundaryOption}</option>
              {boundaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({b.id})
                </option>
              ))}
            </select>
          </label>

          <label className="inspector-field">
            <span>{c4Text.elementLabelField}</span>
            <GuardedInput
              value={selectedElement.label}
              placeholder={c4Text.elementLabelPlaceholder}
              forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
              formatError={safeguard.c4QuotedTextErrorChars}
              onChangeValue={(label) =>
                onUpdateSelectedElement((el) => ({ ...el, label }))
              }
            />
          </label>

          {(selectedElement.kind === 'container' ||
            selectedElement.kind === 'component') && (
            <label className="inspector-field">
              <span>{c4Text.elementTechnField}</span>
              <GuardedInput
                value={selectedElement.techn ?? ''}
                placeholder={c4Text.elementTechnPlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(val) =>
                  onUpdateSelectedElement((el) => ({
                    ...el,
                    techn: val.trim() ? val : undefined,
                  }))
                }
              />
            </label>
          )}

          <label className="inspector-field">
            <span>{c4Text.elementDescrField}</span>
            <GuardedInput
              value={selectedElement.descr ?? ''}
              placeholder={c4Text.elementDescrPlaceholder}
              forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
              formatError={safeguard.c4QuotedTextErrorChars}
              onChangeValue={(val) =>
                onUpdateSelectedElement((el) => ({
                  ...el,
                  descr: val.trim() ? val : undefined,
                }))
              }
            />
          </label>

          <InspectorColorPalette
            label={c4Text.elementColorField}
            value={selectedElement.bgColor}
            clearTitle={c4Text.noColorOption}
            onChange={(nextBg) =>
              onUpdateSelectedElement((el) => ({
                ...el,
                bgColor: nextBg,
                // パステル背景色選択時は白文字で視認性が落ちるため濃い文字色を自動補正する
                fontColor: nextBg
                  ? el.fontColor ?? '#0f172a'
                  : el.fontColor === '#0f172a'
                    ? undefined
                    : el.fontColor,
              }))
            }
          />

          <InspectorColorPalette
            label={c4Text.elementBorderColorField}
            value={selectedElement.borderColor}
            items={STROKE_COLOR_PALETTE_ITEMS}
            allowClear={false}
            labelMap={t.inspector.strokeColors}
            onChange={(borderColor) =>
              onUpdateSelectedElement((el) => ({ ...el, borderColor }))
            }
          />

          <InspectorColorPalette
            label={c4Text.elementTextColorField}
            value={selectedElement.fontColor}
            items={STROKE_COLOR_PALETTE_ITEMS}
            allowClear={false}
            labelMap={{
              ...t.inspector.strokeColors,
              default: c4Text.defaultTextColorOption,
            }}
            onChange={(fontColor) =>
              onUpdateSelectedElement((el) => ({ ...el, fontColor }))
            }
          />

          <button
            type="button"
            className="btn-danger-outline"
            onClick={onDeleteSelectedElement}
          >
            <Trash2 size={14} />
            <span>{c4Text.deleteElementBtn}</span>
          </button>
        </>
      )}
    </InspectorCollapsibleSection>
  );
}
