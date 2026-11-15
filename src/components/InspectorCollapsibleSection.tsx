import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export const COLOR_PALETTE_ITEMS = [
  { value: '#ffffff', key: 'white' },
  { value: '#eff6ff', key: 'blue' },
  { value: '#f0fdf4', key: 'green' },
  { value: '#fefce8', key: 'yellow' },
  { value: '#fef2f2', key: 'red' },
  { value: '#faf5ff', key: 'purple' },
] as const;

export const STROKE_COLOR_PALETTE_ITEMS = [
  { value: '', key: 'default' },
  { value: '#475569', key: 'slate' },
  { value: '#2563eb', key: 'blue' },
  { value: '#16a34a', key: 'green' },
  { value: '#d97706', key: 'amber' },
  { value: '#dc2626', key: 'red' },
  { value: '#9333ea', key: 'purple' },
] as const;

export interface InspectorCollapsibleSectionProps {
  title: string;
  badgeText?: string | number;
  isOpen: boolean;
  onToggle: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function InspectorCollapsibleSection({
  title,
  badgeText,
  isOpen,
  onToggle,
  headerAction,
  children,
}: InspectorCollapsibleSectionProps) {
  return (
    <section className={`inspector-section ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      <div className="inspector-section-header">
        <button
          type="button"
          className="inspector-collapse-toggle"
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span className="inspector-heading">{title}</span>
          {badgeText !== undefined && badgeText !== '' && (
            <span className="inspector-section-badge">{badgeText}</span>
          )}
        </button>
        {headerAction && <div className="inspector-section-action">{headerAction}</div>}
      </div>
      {isOpen && <div className="inspector-section-body">{children}</div>}
    </section>
  );
}
