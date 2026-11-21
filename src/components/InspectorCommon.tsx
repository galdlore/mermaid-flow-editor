import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import {
  COLOR_PALETTE_ITEMS,
  InspectorCollapsibleSection,
} from './InspectorCollapsibleSection';

export interface InspectorBulkControlsProps {
  allExpanded?: boolean;
  onSetAll: (open: boolean) => void;
  mode?: 'toggle' | 'dual';
}

export function InspectorBulkControls({
  allExpanded,
  onSetAll,
  mode,
}: InspectorBulkControlsProps) {
  const { t } = useI18n();
  const isDual = mode === 'dual' || (mode === undefined && allExpanded === undefined);

  return (
    <div className="inspector-accordion-controls">
      {isDual ? (
        <>
          <button
            type="button"
            className="inspector-accordion-ctrl-btn"
            onClick={() => onSetAll(true)}
          >
            {t.inspector.expandAllSections}
          </button>
          <button
            type="button"
            className="inspector-accordion-ctrl-btn"
            onClick={() => onSetAll(false)}
          >
            {t.inspector.collapseAllSections}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="inspector-accordion-ctrl-btn"
          onClick={() => onSetAll(!allExpanded)}
        >
          {allExpanded ? t.inspector.collapseAllSections : t.inspector.expandAllSections}
        </button>
      )}
    </div>
  );
}

function normalizeCommentLines(rawLines: string[]): string[] {
  return rawLines
    .map((line) => line.replace(/^\s*%%+\s?/, '').trim())
    .filter((line) => line.length > 0);
}

export interface InspectorCommentsSectionProps {
  title: string;
  fieldLabel?: string;
  placeholder: string;
  comments: string[] | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onChangeComments: (next: string[] | undefined) => void;
  rows?: number;
  hint?: string;
}

export function InspectorCommentsSection({
  title,
  fieldLabel,
  placeholder,
  comments,
  isOpen,
  onToggle,
  onChangeComments,
  rows = 3,
  hint,
}: InspectorCommentsSectionProps) {
  const { t } = useI18n();
  const [text, setText] = useState(() => (comments ?? []).join('\n'));

  useEffect(() => {
    const nextList = comments ?? [];
    const incomingJoined = normalizeCommentLines(nextList).join('\n');
    setText((prev) => {
      const currentJoined = normalizeCommentLines(prev.split(/\r?\n/)).join('\n');
      return currentJoined === incomingJoined ? prev : nextList.join('\n');
    });
  }, [comments]);

  const handleChange = (rawText: string): void => {
    setText(rawText);
    const cleaned = normalizeCommentLines(rawText.split(/\r?\n/));
    onChangeComments(cleaned.length > 0 ? cleaned : undefined);
  };

  return (
    <InspectorCollapsibleSection
      title={title}
      badgeText={(comments ?? []).length}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <label className="inspector-field">
        <span>{fieldLabel ?? t.inspector.commentsField}</span>
        <textarea
          className="inspector-comments-textarea"
          rows={rows}
          value={text}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
        />
      </label>
      {hint && <p className="inspector-hint">{hint}</p>}
    </InspectorCollapsibleSection>
  );
}

export interface InspectorColorPaletteProps {
  label?: string;
  value: string | undefined;
  onChange: (nextColor: string | undefined) => void;
  items?: ReadonlyArray<{ readonly value: string; readonly key: string }>;
  allowClear?: boolean;
  clearTitle?: string;
  labelMap?: Record<string, string>;
}

export function InspectorColorPalette({
  label,
  value,
  onChange,
  items = COLOR_PALETTE_ITEMS,
  allowClear = true,
  clearTitle,
  labelMap,
}: InspectorColorPaletteProps) {
  const { t } = useI18n();
  const resolvedLabels = labelMap ?? (t.inspector.colors as Record<string, string>);

  return (
    <div className="inspector-field">
      {label && <span>{label}</span>}
      <div className="color-palette-grid">
        {allowClear && (
          <button
            type="button"
            className={`color-swatch is-transparent ${!value ? 'is-active' : ''}`}
            title={clearTitle}
            aria-label={clearTitle}
            onClick={() => onChange(undefined)}
          />
        )}
        {items.map((item) => {
          const isTransparentItem = item.value === '';
          const titleText = resolvedLabels[item.key] ?? item.value ?? item.key;
          const isActive = isTransparentItem
            ? !value
            : value === item.value;
          return (
            <button
              key={item.key}
              type="button"
              className={`color-swatch ${isTransparentItem ? 'is-transparent ' : ''}${
                isActive ? 'is-active' : ''
              }`}
              style={isTransparentItem ? undefined : { backgroundColor: item.value }}
              title={titleText}
              aria-label={titleText}
              onClick={() => onChange(isTransparentItem ? undefined : item.value)}
            />
          );
        })}
      </div>
    </div>
  );
}

export interface CommitIdInputProps {
  label: string;
  value: string;
  onCommit: (rawNext: string) => string | void;
  forbiddenRegex: RegExp;
  formatError: (blockedChars: string[]) => string;
  placeholder?: string;
  ariaLabel?: string;
  hint?: string;
}

export function CommitIdInput({
  label,
  value,
  onCommit,
  forbiddenRegex,
  formatError,
  placeholder,
  ariaLabel,
  hint,
}: CommitIdInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleCommit = (): void => {
    const normalized = onCommit(draft);
    if (typeof normalized === 'string') {
      setDraft(normalized);
    } else if (draft.trim() === '') {
      setDraft(value);
    }
  };

  return (
    <label className="inspector-field">
      <span>{label}</span>
      <GuardedInput
        value={draft}
        placeholder={placeholder}
        ariaLabel={ariaLabel ?? label}
        forbiddenRegex={forbiddenRegex}
        formatError={formatError}
        onChangeValue={setDraft}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleCommit();
          }
        }}
      />
      {hint && <p className="inspector-hint">{hint}</p>}
    </label>
  );
}
