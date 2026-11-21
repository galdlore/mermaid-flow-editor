import { serializerCtx } from '@milkdown/kit/core';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { NodeView } from '@milkdown/kit/prose/view';
import { $view } from '@milkdown/kit/utils';
import { renderMermaidSvg } from '../../utils/mermaidRender';
import type { WysiwygEditorStrings } from './types';

const PENCIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';

const MERMAID_PASSTHROUGH_EVENTS = new Set([
  'pointermove',
  'dragstart',
  'dragover',
  'dragenter',
  'dragleave',
  'drop',
  'dragend',
]);

function isMermaidCodeBlock(node: ProseNode): boolean {
  return String(node.attrs.language ?? '').trim().toLowerCase() === 'mermaid';
}

function countMermaidBlocksBeforePos(doc: ProseNode, targetPos: number): number {
  let count = 0;
  doc.descendants((node, pos) => {
    if (pos >= targetPos) {
      return false;
    }
    if (node.type.name === 'code_block' && isMermaidCodeBlock(node)) {
      count += 1;
    }
    return true;
  });
  return count;
}

function createErrorElement(title: string, message: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'mermaid-error-box';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const pre = document.createElement('pre');
  pre.textContent = message;
  box.append(strong, pre);
  return box;
}

export interface CreateMermaidBlockViewDeps {
  isDisposed: () => boolean;
  getStrings: () => WysiwygEditorStrings;
  getLastEmitted: () => string;
  onSyncExternalMarkdown: (nextMarkdown: string) => void;
  onEditMermaid: (blockIndex: number, code: string) => void;
}

export function createMermaidBlockViewPlugin(deps: CreateMermaidBlockViewDeps) {
  return $view(codeBlockSchema.node, (ctx) => {
    return (initialNode, view, getPos): NodeView => {
      if (!isMermaidCodeBlock(initialNode)) {
        const pre = document.createElement('pre');
        pre.className = 'markdown-code-pre';
        const code = document.createElement('code');
        pre.appendChild(code);

        return {
          dom: pre,
          contentDOM: code,
          update(nextNode) {
            if (nextNode.type !== initialNode.type || isMermaidCodeBlock(nextNode)) {
              return false;
            }
            return true;
          },
        };
      }

      let currentNode = initialNode;
      let renderSeq = 0;
      const strings = deps.getStrings();

      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-pre-container wysiwyg-mermaid-block';
      wrapper.contentEditable = 'false';

      const card = document.createElement('div');
      card.className = 'mermaid-preview-card';
      card.dataset.mermaidBlock = 'true';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'mermaid-edit-float-btn';
      editBtn.title = strings.editTitle;
      editBtn.innerHTML = `${PENCIL_SVG}<span></span>`;
      const btnLabelSpan = editBtn.querySelector('span');
      if (btnLabelSpan) {
        btnLabelSpan.textContent = strings.editLabel;
      }

      const body = document.createElement('div');
      body.className = 'wysiwyg-mermaid-body';

      const handleEditClick = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        const pos = typeof getPos === 'function' ? getPos() : 0;
        const blockIndex =
          typeof pos === 'number'
            ? countMermaidBlocksBeforePos(view.state.doc, pos)
            : 0;
        const serialized = ctx.get(serializerCtx)(view.state.doc);
        if (serialized !== deps.getLastEmitted()) {
          deps.onSyncExternalMarkdown(serialized);
        }
        deps.onEditMermaid(blockIndex, currentNode.textContent);
      };

      const handleEditMouseDown = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
      };

      editBtn.addEventListener('mousedown', handleEditMouseDown);
      editBtn.addEventListener('click', handleEditClick);

      const renderDiagram = async (): Promise<void> => {
        renderSeq += 1;
        const seq = renderSeq;
        const code = currentNode.textContent;
        const latestStrings = deps.getStrings();
        if (!code.trim()) {
          body.replaceChildren(
            createErrorElement(latestStrings.renderErrorTitle, latestStrings.emptyError)
          );
          return;
        }

        const renderId = `mermaid_wysiwyg_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const result = await renderMermaidSvg(renderId, code);
        if (deps.isDisposed() || seq !== renderSeq) {
          return;
        }
        if (result.error) {
          body.replaceChildren(
            createErrorElement(latestStrings.renderErrorTitle, result.error)
          );
          return;
        }
        const svgContainer = document.createElement('div');
        svgContainer.className = 'mermaid-svg-container';
        svgContainer.innerHTML = result.svg;
        body.replaceChildren(svgContainer);
      };

      card.append(editBtn, body);
      wrapper.appendChild(card);
      void renderDiagram();

      return {
        dom: wrapper,
        update(nextNode) {
          if (nextNode.type !== initialNode.type || !isMermaidCodeBlock(nextNode)) {
            return false;
          }
          if (nextNode.textContent !== currentNode.textContent) {
            currentNode = nextNode;
            void renderDiagram();
          }
          return true;
        },
        stopEvent(event) {
          return !MERMAID_PASSTHROUGH_EVENTS.has(event.type);
        },
        ignoreMutation() {
          return true;
        },
        destroy() {
          renderSeq += 1;
          editBtn.removeEventListener('mousedown', handleEditMouseDown);
          editBtn.removeEventListener('click', handleEditClick);
        },
      };
    };
  });
}
