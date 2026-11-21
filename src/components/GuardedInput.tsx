import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { filterForbiddenChars } from '../utils/inputSafeguard';

export interface GuardedInputProps {
  value: string;
  onChangeValue: (nextValue: string) => void;
  forbiddenRegex: RegExp;
  formatError: (blockedChars: string[]) => string;
  type?: 'text' | 'url';
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Mermaid構文エラーの原因になる禁止文字をブロックし、警告を表示する入力欄。
 */
export default function GuardedInput({
  value,
  onChangeValue,
  forbiddenRegex,
  formatError,
  type = 'text',
  placeholder,
  ariaLabel,
  className,
  onBlur,
  onKeyDown,
}: GuardedInputProps) {
  const isComposingRef = useRef(false);
  const clearTimerRef = useRef<number | null>(null);
  const [draftValue, setDraftValue] = useState(value);
  const [blockedChars, setBlockedChars] = useState<string[]>([]);

  useEffect(() => {
    if (!isComposingRef.current) {
      setDraftValue(value);
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const showBlockedWarning = (chars: string[]): void => {
    setBlockedChars(chars);
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      setBlockedChars([]);
      clearTimerRef.current = null;
    }, 4500);
  };

  const applySafeguard = (raw: string): void => {
    const result = filterForbiddenChars(raw, forbiddenRegex);
    setDraftValue(result.cleaned);
    if (result.blockedChars.length > 0) {
      showBlockedWarning(result.blockedChars);
    }
    if (result.cleaned !== value) {
      onChangeValue(result.cleaned);
    }
  };

  const inputClassName = [
    className,
    blockedChars.length > 0 ? 'has-safeguard-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="guarded-input-wrapper">
      <input
        type={type}
        className={inputClassName || undefined}
        value={draftValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={blockedChars.length > 0}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          applySafeguard(event.currentTarget.value);
        }}
        onChange={(event) => {
          const nextRaw = event.target.value;
          if (isComposingRef.current) {
            setDraftValue(nextRaw);
            return;
          }
          applySafeguard(nextRaw);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (clearTimerRef.current !== null) {
            window.clearTimeout(clearTimerRef.current);
            clearTimerRef.current = null;
          }
          setBlockedChars([]);
          onBlur?.();
        }}
      />
      {blockedChars.length > 0 && (
        <p className="safeguard-error-text" role="alert">
          {formatError(blockedChars)}
        </p>
      )}
    </div>
  );
}
