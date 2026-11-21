import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { jaCatalog } from '../locales/ja';
import {
  clearDiagramHandlerCache,
  DIAGRAM_TYPE_OPTIONS,
  getDiagramRegistryEntry,
} from '../diagrams/registry';
import { detectMermaidDiagramType } from '../utils/diagramDetect';
import { renderMermaidSvg } from '../utils/mermaidRender';
import MermaidModal from './MermaidModal';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof globalThis.DOMMatrixReadOnly === 'undefined') {
  globalThis.DOMMatrixReadOnly = class DOMMatrixReadOnly {
    m22 = 1;
    constructor() {}
  } as unknown as typeof DOMMatrixReadOnly;
}

vi.mock('../utils/mermaidRender', () => ({
  renderMermaidSvg: vi.fn().mockResolvedValue({
    svg: '<svg data-testid="mock-svg"></svg>',
    error: null,
  }),
}));

describe('MermaidModal', () => {
  beforeEach(() => {
    clearDiagramHandlerCache();
    vi.mocked(renderMermaidSvg).mockReset();
    vi.mocked(renderMermaidSvg).mockResolvedValue({
      svg: '<svg data-testid="mock-svg"></svg>',
      error: null,
    });
  });

  it(
    'switches cleanly through all 31 diagram types and emits detectable code on Apply',
    async () => {
      const onApply = vi.fn();
      const onClose = vi.fn();

      render(
        <I18nProvider>
          <MermaidModal
            isOpen
            initialCode=""
            onApply={onApply}
            onClose={onClose}
          />
        </I18nProvider>
      );

      expect(DIAGRAM_TYPE_OPTIONS).toHaveLength(31);

      const select = screen.getByRole('combobox', {
        name: jaCatalog.modal.diagramTypeLabel,
      }) as HTMLSelectElement;
      const applyButton = screen.getByRole('button', {
        name: jaCatalog.modal.apply,
      });

      for (const option of DIAGRAM_TYPE_OPTIONS) {
        if (select.value !== option.id) {
          fireEvent.change(select, { target: { value: option.id } });
        }

        const expectedSubtitle = getDiagramRegistryEntry(option.id).getSubtitle(jaCatalog);

        await waitFor(() => {
          expect(select.value).toBe(option.id);
          expect(applyButton).toBeEnabled();
          expect(document.querySelector('.modal-diagram-loading')).toBeNull();
          expect(document.querySelector('.modal-subtitle')).toHaveTextContent(
            expectedSubtitle
          );
          expect(document.querySelector('.modal-canvas-pane .mermaid-error-box')).toBeNull();
          expect(
            document.querySelector('.modal-canvas-pane')?.children.length ?? 0
          ).toBeGreaterThan(0);
          expect(
            document.querySelector('.modal-inspector-pane')?.children.length ?? 0
          ).toBeGreaterThan(0);
        });

        onApply.mockClear();
        fireEvent.click(applyButton);

        expect(onApply).toHaveBeenCalledTimes(1);
        const emitted = onApply.mock.calls[0]?.[0] as string;
        expect(typeof emitted).toBe('string');
        expect(emitted.trim().length).toBeGreaterThan(0);
        expect(detectMermaidDiagramType(emitted)).toBe(option.id);
      }
    },
    20000
  );

  it('auto-detects existing diagram code when opening for sequence and timeline diagrams', async () => {
    const onApply = vi.fn();
    const { rerender } = render(
      <I18nProvider>
        <MermaidModal
          isOpen
          initialCode={'sequenceDiagram\n  Alice->>Bob: Hello'}
          onApply={onApply}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    const select = screen.getByRole('combobox', {
      name: jaCatalog.modal.diagramTypeLabel,
    }) as HTMLSelectElement;
    const applyButton = screen.getByRole('button', {
      name: jaCatalog.modal.apply,
    });

    await waitFor(() => {
      expect(select.value).toBe('sequence');
      expect(applyButton).toBeEnabled();
      expect(document.querySelector('.modal-diagram-loading')).toBeNull();
    });

    fireEvent.click(applyButton);
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('sequenceDiagram'));

    onApply.mockClear();
    rerender(
      <I18nProvider>
        <MermaidModal
          isOpen
          initialCode={'timeline\n  title Roadmap\n  2026 Q1 : Alpha'}
          onApply={onApply}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(select.value).toBe('timeline');
      expect(applyButton).toBeEnabled();
      expect(document.querySelector('.modal-diagram-loading')).toBeNull();
    });

    fireEvent.click(applyButton);
    const emittedTimeline = onApply.mock.calls[0]?.[0] as string;
    expect(emittedTimeline).toContain('timeline');
    expect(emittedTimeline).toContain('2026 Q1');
  });

  it('reflects inspector edits into generated code and handles flowchart -> swimlane transition', async () => {
    const onApply = vi.fn();
    render(
      <I18nProvider>
        <MermaidModal
          isOpen
          initialCode=""
          onApply={onApply}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    const applyButton = screen.getByRole('button', {
      name: jaCatalog.modal.apply,
    });
    const nodeLabelInput = await screen.findByPlaceholderText(
      jaCatalog.inspector.nodeLabelPlaceholder
    );

    fireEvent.change(nodeLabelInput, { target: { value: '承認ステップ' } });

    fireEvent.click(screen.getByRole('button', { name: jaCatalog.modal.tabCode }));
    await waitFor(() => {
      expect(document.querySelector('.modal-generated-code')).toHaveTextContent(
        '承認ステップ'
      );
    });

    fireEvent.click(applyButton);
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('承認ステップ'));

    onApply.mockClear();
    const select = screen.getByRole('combobox', {
      name: jaCatalog.modal.diagramTypeLabel,
    }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'swimlane' } });

    await waitFor(() => {
      expect(select.value).toBe('swimlane');
      expect(applyButton).toBeEnabled();
      expect(document.querySelector('.modal-generated-code')).toHaveTextContent(
        'subgraph'
      );
    });

    fireEvent.click(applyButton);
    const swimlaneCode = onApply.mock.calls[0]?.[0] as string;
    expect(detectMermaidDiagramType(swimlaneCode)).toBe('swimlane');
    expect(swimlaneCode).toContain('subgraph');

    onApply.mockClear();
    fireEvent.change(select, { target: { value: 'timeline' } });

    const periodInput = await screen.findByPlaceholderText(
      jaCatalog.inspector.timeline.periodLabelPlaceholder
    );
    fireEvent.change(periodInput, { target: { value: '2026 Q4' } });

    await waitFor(() => {
      expect(document.querySelector('.modal-generated-code')).toHaveTextContent(
        '2026 Q4'
      );
    });

    fireEvent.click(applyButton);
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('2026 Q4'));

    const strategyCases = [
      {
        type: 'journey',
        placeholder: jaCatalog.inspector.journey.taskLabelPlaceholder,
        editedText: 'Login Review Step',
      },
      {
        type: 'treemap',
        placeholder: jaCatalog.inspector.treemap.nodeLabelPlaceholder,
        editedText: 'Core Analytics',
      },
      {
        type: 'venn',
        placeholder: jaCatalog.inspector.venn.setLabelPlaceholder,
        editedText: 'Frontend Domain',
      },
      {
        type: 'wardley',
        placeholder: jaCatalog.inspector.wardley.namePlaceholder,
        editedText: 'API Gateway V2',
      },
      {
        type: 'cynefin',
        placeholder: jaCatalog.inspector.cynefin.itemLabelPlaceholder,
        editedText: 'Probe Signal Test',
      },
      {
        type: 'requirement',
        placeholder: jaCatalog.inspector.requirement.reqNamePlaceholder,
        editedText: 'MFA Login Rule',
      },
      {
        type: 'packet',
        placeholder: jaCatalog.inspector.packet.blockLabelPlaceholder,
        editedText: 'Checksum Field',
      },
      {
        type: 'eventmodeling',
        placeholder: jaCatalog.inspector.eventmodeling.entityNamePlaceholder,
        editedText: 'UpdatedForm',
      },
      {
        type: 'sankey',
        placeholder: jaCatalog.inspector.sankey.sourcePlaceholder,
        editedText: 'SalesTotal',
      },
      {
        type: 'radar',
        placeholder: jaCatalog.inspector.radar.curveLabelPlaceholder,
        editedText: 'Core Team',
      },
      {
        type: 'info',
        placeholder: jaCatalog.inspector.info.titlePlaceholder,
        editedText: 'Custom Runtime Info',
      },
    ] as const;

    for (const item of strategyCases) {
      onApply.mockClear();
      fireEvent.change(select, { target: { value: item.type } });

      const input = await screen.findByPlaceholderText(item.placeholder);
      fireEvent.change(input, { target: { value: item.editedText } });

      await waitFor(() => {
        expect(
          document.querySelector('.modal-generated-code')
        ).toHaveTextContent(item.editedText);
      });

      fireEvent.click(applyButton);
      expect(onApply).toHaveBeenCalledWith(
        expect.stringContaining(item.editedText)
      );
    }
  });

  it('shows preview error box safely when Mermaid rendering fails', async () => {
    vi.mocked(renderMermaidSvg).mockResolvedValue({
      svg: '',
      error: 'Syntax error in graph',
    });

    render(
      <I18nProvider>
        <MermaidModal
          isOpen
          initialCode=""
          onApply={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    await waitFor(() => {
      const errorBox = document.querySelector('.modal-bottom-panel .mermaid-error-box');
      expect(errorBox).not.toBeNull();
      expect(errorBox).toHaveTextContent('Syntax error in graph');
    });
  });
});
