import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { Check, ExternalLink, Pencil, Unlink, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { getClampedMenuStyle } from './WysiwygBlockMenus';
import { validateLinkHrefInput } from './linkUtils';
import type { WysiwygLinkPopoverState } from './types';

export interface WysiwygLinkPopoverProps {
  popover: WysiwygLinkPopoverState | null;
  containerRef: RefObject<HTMLDivElement>;
  onOpenHref: (href: string) => void;
  onSwitchToEdit: () => void;
  onApply: (label: string, href: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function WysiwygLinkPopover({
  popover,
  containerRef,
  onOpenHref,
  onSwitchToEdit,
  onApply,
  onRemove,
  onClose,
}: WysiwygLinkPopoverProps) {
  const { t } = useI18n();
  const [labelDraft, setLabelDraft] = useState('');
  const [hrefDraft, setHrefDraft] = useState('');
  const [errorReason, setErrorReason] = useState<'empty' | 'unsafe' | null>(null);

  const labelInputRef = useRef<HTMLInputElement>(null);
  const hrefInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!popover) {
      setErrorReason(null);
      return;
    }
    setLabelDraft(popover.label);
    setHrefDraft(popover.href);
    setErrorReason(null);

    if (popover.mode !== 'edit') {
      return;
    }
    const rafId = requestAnimationFrame(() => {
      if (popover.label.trim().length > 0) {
        hrefInputRef.current?.focus();
        hrefInputRef.current?.select();
      } else {
        labelInputRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [popover]);

  if (!popover) {
    return null;
  }

  if (popover.mode === 'preview') {
    const validated = validateLinkHrefInput(popover.href);
    return (
      <div
        ref={containerRef}
        className="wysiwyg-link-popover wysiwyg-link-preview-bar"
        role="dialog"
        aria-label={t.editor.linkPopoverAria}
        style={getClampedMenuStyle(popover.anchorTop, popover.anchorLeft, 320, 44)}
      >
        <button
          type="button"
          className="wysiwyg-link-preview-url"
          title={popover.href}
          disabled={!validated.ok}
          onClick={() => onOpenHref(popover.href)}
        >
          {popover.href}
        </button>
        <span className="wysiwyg-link-preview-sep" aria-hidden="true" />
        <button
          type="button"
          className="wysiwyg-link-icon-btn"
          title={t.editor.linkOpenBtn}
          aria-label={t.editor.linkOpenBtn}
          disabled={!validated.ok}
          onClick={() => onOpenHref(popover.href)}
        >
          <ExternalLink size={14} />
        </button>
        <button
          type="button"
          className="wysiwyg-link-icon-btn"
          title={t.editor.linkEditBtn}
          aria-label={t.editor.linkEditBtn}
          onClick={onSwitchToEdit}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="wysiwyg-link-icon-btn is-danger"
          title={t.editor.linkRemoveBtn}
          aria-label={t.editor.linkRemoveBtn}
          onClick={onRemove}
        >
          <Unlink size={14} />
        </button>
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const validation = validateLinkHrefInput(hrefDraft);
    if (!validation.ok) {
      setErrorReason(validation.reason);
      hrefInputRef.current?.focus();
      return;
    }
    onApply(labelDraft, validation.href);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const errorMessage =
    errorReason === 'empty'
      ? t.editor.linkUrlEmptyError
      : errorReason === 'unsafe'
        ? t.editor.linkUrlUnsafeError
        : null;

  return (
    <div
      ref={containerRef}
      className="wysiwyg-link-popover wysiwyg-link-edit-box"
      role="dialog"
      aria-label={t.editor.linkPopoverAria}
      style={getClampedMenuStyle(popover.anchorTop, popover.anchorLeft, 320, 190)}
    >
      <form className="wysiwyg-link-form" onSubmit={handleSubmit}>
        <label className="wysiwyg-link-field">
          <span className="wysiwyg-link-field-label">{t.editor.linkTextLabel}</span>
          <input
            ref={labelInputRef}
            type="text"
            className="wysiwyg-link-input"
            value={labelDraft}
            placeholder={t.editor.linkTextPlaceholder}
            onChange={(event) => setLabelDraft(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
        </label>

        <label className="wysiwyg-link-field">
          <span className="wysiwyg-link-field-label">{t.editor.linkUrlLabel}</span>
          <input
            ref={hrefInputRef}
            type="text"
            className={`wysiwyg-link-input ${errorMessage ? 'is-invalid' : ''}`}
            value={hrefDraft}
            placeholder={t.editor.linkUrlPlaceholder}
            aria-invalid={errorMessage !== null}
            onChange={(event) => {
              setHrefDraft(event.target.value);
              if (errorReason !== null) {
                setErrorReason(null);
              }
            }}
            onKeyDown={handleInputKeyDown}
          />
        </label>

        {errorMessage && (
          <div className="wysiwyg-link-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="wysiwyg-link-actions">
          {!popover.isNew && (
            <button
              type="button"
              className="wysiwyg-link-btn is-danger"
              onClick={onRemove}
            >
              <Unlink size={13} />
              <span>{t.editor.linkRemoveBtn}</span>
            </button>
          )}
          <div className="wysiwyg-link-actions-right">
            <button type="button" className="wysiwyg-link-btn" onClick={onClose}>
              <X size={13} />
              <span>{t.editor.linkCancelBtn}</span>
            </button>
            <button type="submit" className="wysiwyg-link-btn is-primary">
              <Check size={13} />
              <span>{t.editor.linkApplyBtn}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
