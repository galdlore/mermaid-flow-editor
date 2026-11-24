import { ArrowLeftRight, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import {
  InspectorCollapsibleSection,
  STROKE_COLOR_PALETTE_ITEMS,
} from '../InspectorCollapsibleSection';
import { InspectorColorPalette } from '../InspectorCommon';
import {
  FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX,
  FORBIDDEN_C4_TITLE_CHARS_REGEX,
} from '../../utils/inputSafeguard';
import type {
  C4DiagramData,
  C4DiagramSubtype,
  C4ElementData,
  C4RelationData,
  C4RelationType,
} from '../../types/editor';
import {
  C4_RELATION_TYPE_OPTIONS,
  C4_SUBTYPE_OPTIONS,
} from '../../utils/c4Converter';

const ROW_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export interface C4RelationSectionProps {
  elements: ReadonlyArray<C4ElementData>;
  relationsCount: number;
  selectedRelation: C4RelationData | null;
  isOpen: boolean;
  onToggle: () => void;
  onUpdateSelectedRelation: (updater: (r: C4RelationData) => C4RelationData) => void;
  onDeleteSelectedRelation: () => void;
}

export function C4RelationSection({
  elements,
  relationsCount,
  selectedRelation,
  isOpen,
  onToggle,
  onUpdateSelectedRelation,
  onDeleteSelectedRelation,
}: C4RelationSectionProps) {
  const { t } = useI18n();
  const c4Text = t.inspector.c4Diagram;
  const safeguard = t.inspector.safeguard;

  return (
    <InspectorCollapsibleSection
      title={c4Text.relationSection}
      badgeText={relationsCount > 0 ? String(relationsCount) : undefined}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {!selectedRelation ? (
        <p className="inspector-hint">{c4Text.selectRelationPrompt}</p>
      ) : (
        <>
          <label className="inspector-field">
            <span>{c4Text.relTypeField}</span>
            <select
              value={selectedRelation.relType}
              onChange={(e) => {
                const nextType = e.target.value as C4RelationType;
                onUpdateSelectedRelation((r) => ({
                  ...r,
                  relType: nextType,
                  ...(nextType !== 'RelIndex' ? { index: undefined } : {}),
                }));
              }}
            >
              {C4_RELATION_TYPE_OPTIONS.map((rt) => (
                <option key={rt} value={rt}>
                  {c4Text.relationTypes[rt]}
                </option>
              ))}
            </select>
          </label>

          {selectedRelation.relType === 'RelIndex' && (
            <label className="inspector-field">
              <span>{c4Text.relIndexField}</span>
              <GuardedInput
                value={selectedRelation.index ?? ''}
                placeholder="1"
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(val) =>
                  onUpdateSelectedRelation((r) => ({
                    ...r,
                    index: val.trim() ? val : undefined,
                  }))
                }
              />
            </label>
          )}

          <label className="inspector-field">
            <span>{c4Text.relFromField}</span>
            <select
              value={selectedRelation.from}
              onChange={(e) =>
                onUpdateSelectedRelation((r) => ({ ...r, from: e.target.value }))
              }
            >
              {elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.label} ({el.id})
                </option>
              ))}
            </select>
          </label>

          <label className="inspector-field">
            <span>{c4Text.relToField}</span>
            <select
              value={selectedRelation.to}
              onChange={(e) =>
                onUpdateSelectedRelation((r) => ({ ...r, to: e.target.value }))
              }
            >
              {elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.label} ({el.id})
                </option>
              ))}
            </select>
          </label>

          <label className="inspector-field">
            <span>{c4Text.relLabelField}</span>
            <GuardedInput
              value={selectedRelation.label}
              placeholder={c4Text.relLabelPlaceholder}
              forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
              formatError={safeguard.c4QuotedTextErrorChars}
              onChangeValue={(label) =>
                onUpdateSelectedRelation((r) => ({ ...r, label }))
              }
            />
          </label>

          <label className="inspector-field">
            <span>{c4Text.relTechnField}</span>
            <GuardedInput
              value={selectedRelation.techn ?? ''}
              placeholder={c4Text.relTechnPlaceholder}
              forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
              formatError={safeguard.c4QuotedTextErrorChars}
              onChangeValue={(val) =>
                onUpdateSelectedRelation((r) => ({
                  ...r,
                  techn: val.trim() ? val : undefined,
                }))
              }
            />
          </label>

          <label className="inspector-field">
            <span>{c4Text.relDescrField}</span>
            <GuardedInput
              value={selectedRelation.descr ?? ''}
              placeholder={c4Text.relDescrPlaceholder}
              forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
              formatError={safeguard.c4QuotedTextErrorChars}
              onChangeValue={(val) =>
                onUpdateSelectedRelation((r) => ({
                  ...r,
                  descr: val.trim() ? val : undefined,
                }))
              }
            />
          </label>

          <InspectorColorPalette
            label={c4Text.relLineColorField}
            value={selectedRelation.lineColor}
            items={STROKE_COLOR_PALETTE_ITEMS}
            allowClear={false}
            labelMap={t.inspector.strokeColors}
            onChange={(lineColor) =>
              onUpdateSelectedRelation((r) => ({ ...r, lineColor }))
            }
          />

          <InspectorColorPalette
            label={c4Text.relTextColorField}
            value={selectedRelation.textColor}
            items={STROKE_COLOR_PALETTE_ITEMS}
            allowClear={false}
            labelMap={{
              ...t.inspector.strokeColors,
              default: c4Text.defaultTextColorOption,
            }}
            onChange={(textColor) =>
              onUpdateSelectedRelation((r) => ({ ...r, textColor }))
            }
          />

          <div className="inspector-actions-row">
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={() =>
                onUpdateSelectedRelation((r) => ({
                  ...r,
                  from: r.to,
                  to: r.from,
                }))
              }
            >
              <ArrowLeftRight size={13} />
              <span>{c4Text.swapEndpointsBtn}</span>
            </button>
            <button
              type="button"
              className="btn-danger-outline"
              onClick={onDeleteSelectedRelation}
            >
              <Trash2 size={13} />
              <span>{c4Text.deleteRelationBtn}</span>
            </button>
          </div>
        </>
      )}
    </InspectorCollapsibleSection>
  );
}

export interface C4SettingsSectionProps {
  c4Data: C4DiagramData;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (next: C4DiagramData) => void;
}

export function C4SettingsSection({
  c4Data,
  isOpen,
  onToggle,
  onChange,
}: C4SettingsSectionProps) {
  const { t } = useI18n();
  const c4Text = t.inspector.c4Diagram;
  const safeguard = t.inspector.safeguard;

  return (
    <InspectorCollapsibleSection
      title={c4Text.settingsSection}
      badgeText={c4Data.subtype}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <label className="inspector-field">
        <span>{c4Text.subtypeField}</span>
        <select
          value={c4Data.subtype}
          onChange={(e) =>
            onChange({
              ...c4Data,
              subtype: e.target.value as C4DiagramSubtype,
            })
          }
        >
          {C4_SUBTYPE_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {c4Text.subtypes[st]}
            </option>
          ))}
        </select>
      </label>

      <label className="inspector-field">
        <span>{c4Text.titleField}</span>
        <GuardedInput
          value={c4Data.title ?? ''}
          placeholder={c4Text.titlePlaceholder}
          forbiddenRegex={FORBIDDEN_C4_TITLE_CHARS_REGEX}
          formatError={safeguard.c4TitleErrorChars}
          onChangeValue={(val) =>
            onChange({
              ...c4Data,
              title: val.trim() ? val : undefined,
            })
          }
        />
      </label>

      <label className="inspector-field">
        <span>{c4Text.shapeInRowField}</span>
        <select
          value={c4Data.shapeInRow ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            onChange({
              ...c4Data,
              shapeInRow: raw ? Number(raw) : undefined,
            });
          }}
        >
          <option value="">{c4Text.autoOption}</option>
          {ROW_COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="inspector-field">
        <span>{c4Text.boundaryInRowField}</span>
        <select
          value={c4Data.boundaryInRow ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            onChange({
              ...c4Data,
              boundaryInRow: raw ? Number(raw) : undefined,
            });
          }}
        >
          <option value="">{c4Text.autoOption}</option>
          {ROW_COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </InspectorCollapsibleSection>
  );
}
