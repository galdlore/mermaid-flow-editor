import { useEffect, useRef } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import { useI18n } from '../i18n';
import type { DocumentTab } from '../utils/documentTabs';

export interface TabBarProps {
  tabs: readonly DocumentTab[];
  activeTabId: string;
  displayTitles: Record<string, string>;
  switcherOpen: boolean;
  onCloseSwitcher: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  displayTitles,
  switcherOpen,
  onCloseSwitcher,
  onSelectTab,
  onCloseTab,
  onNewTab,
}: TabBarProps) {
  const { t } = useI18n();
  const activeTabButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeTabButtonRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeTabId, tabs.length]);

  useEffect(() => {
    if (!switcherOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseSwitcher();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [switcherOpen, onCloseSwitcher]);

  return (
    <>
      <nav className="doc-tabbar" aria-label={t.tabs.switcherAria}>
        <div className="doc-tabbar-list" role="tablist">
          {tabs.map((tab) => {
            const title = displayTitles[tab.id] || t.app.untitledFileName;
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                ref={isActive ? activeTabButtonRef : undefined}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={`doc-tab-item ${isActive ? 'is-active' : ''}`}
                title={tab.filePath ?? title}
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectTab(tab.id);
                  }
                }}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault();
                    onCloseTab(tab.id);
                  }
                }}
              >
                <FileText size={13} className="doc-tab-icon" />
                <span className="doc-tab-title">{title}</span>
                {tab.isDirty && (
                  <span
                    className="doc-tab-dirty-dot"
                    title={t.toolbar.unsavedBadge}
                    aria-label={t.toolbar.unsavedBadge}
                  />
                )}
                <button
                  type="button"
                  className="doc-tab-close-btn"
                  aria-label={t.tabs.closeTabAria(title)}
                  title={t.tabs.closeTabAria(title)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="doc-tab-add-btn"
          onClick={onNewTab}
          title={t.tabs.newTabTitle}
          aria-label={t.tabs.newTabTitle}
        >
          <Plus size={15} />
        </button>
      </nav>

      {switcherOpen && (
        <div
          className="tab-switcher-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t.tabs.sheetTitle(tabs.length)}
          onClick={onCloseSwitcher}
        >
          <div className="tab-switcher-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="tab-switcher-header">
              <span className="tab-switcher-heading">{t.tabs.sheetTitle(tabs.length)}</span>
              <div className="tab-switcher-header-actions">
                <button
                  type="button"
                  className="tab-switcher-add-btn"
                  onClick={() => {
                    onNewTab();
                    onCloseSwitcher();
                  }}
                >
                  <Plus size={15} />
                  <span>{t.tabs.addTabButton}</span>
                </button>
                <button
                  type="button"
                  className="tab-switcher-close-sheet-btn"
                  onClick={onCloseSwitcher}
                  aria-label={t.tabs.closeSheet}
                  title={t.tabs.closeSheet}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="tab-switcher-list" role="listbox">
              {tabs.map((tab) => {
                const title = displayTitles[tab.id] || t.app.untitledFileName;
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    role="option"
                    aria-selected={isActive}
                    className={`tab-switcher-row ${isActive ? 'is-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="tab-switcher-row-main"
                      onClick={() => {
                        onSelectTab(tab.id);
                        onCloseSwitcher();
                      }}
                    >
                      <FileText size={15} className="tab-switcher-row-icon" />
                      <span className="tab-switcher-row-title">{title}</span>
                      {tab.isDirty && (
                        <span className="unsaved-badge">{t.toolbar.unsavedBadge}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="tab-switcher-row-close"
                      aria-label={t.tabs.closeTabAria(title)}
                      title={t.tabs.closeTabAria(title)}
                      onClick={() => onCloseTab(tab.id)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
