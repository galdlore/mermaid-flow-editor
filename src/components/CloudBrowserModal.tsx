import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUp,
  Check,
  FileText,
  Folder,
  FolderPlus,
  Link2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { isSupportedDroppedFileName } from '../utils/documentTabs';
import {
  buildMarkdownLink,
  computeRelativeMarkdownPath,
  stripMarkdownExtension,
} from '../utils/markdownLinks';
import {
  buildRemoteTargetUrl,
  createRemoteWebdavFolder,
  joinRemoteRelativePath,
  listRemoteWebdavDirectory,
  loadMarkdownFromRemote,
  normalizeRemoteRelativePath,
  splitRemoteRelativePath,
  type RemoteCredentials,
  type RemoteDirectoryEntry,
  type RemoteRequestResult,
  type RemoteSaveSettings,
} from '../utils/remoteStorage';

export interface CloudBrowserModalProps {
  isOpen: boolean;
  mode: 'open' | 'save-as' | 'insert-link';
  remoteSettings: RemoteSaveSettings;
  remoteCredentials: RemoteCredentials;
  initialSubPath: string;
  initialFileName: string;
  currentRemotePath?: string | null;
  initialLinkLabel?: string;
  onOpenedFile: (remotePath: string, content: string) => void;
  onSaveToPath: (remotePath: string) => Promise<{ ok: boolean; errorText?: string }>;
  onInsertLink?: (label: string, href: string) => void;
  onClose: () => void;
}

function formatByteSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CloudBrowserModal({
  isOpen,
  mode,
  remoteSettings,
  remoteCredentials,
  initialSubPath,
  initialFileName,
  currentRemotePath,
  initialLinkLabel,
  onOpenedFile,
  onSaveToPath,
  onInsertLink,
  onClose,
}: CloudBrowserModalProps) {
  const { t } = useI18n();
  const [currentSubPath, setCurrentSubPath] = useState('');
  const [entries, setEntries] = useState<RemoteDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');
  const [linkFormat, setLinkFormat] = useState<'relative' | 'webdav-url'>('relative');
  const [linkLabelInput, setLinkLabelInput] = useState('');
  const [linkLabelEdited, setLinkLabelEdited] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const prevOpenRef = useRef(false);
  const listRequestIdRef = useRef(0);

  const isWebdav = remoteSettings.protocol === 'webdav';

  const formatRemoteError = useCallback(
    (res: RemoteRequestResult): string => {
      if (res.permissionDenied) {
        return t.app.statusRemotePermissionDenied;
      }
      if (res.isCorsOrNetworkError) {
        return t.app.statusRemoteCorsHint;
      }
      return res.error || `HTTP ${res.status}`;
    },
    [t]
  );

  const fetchDirectory = useCallback(
    async (targetSubPath: string) => {
      if (!isWebdav) {
        setEntries([]);
        setListError(null);
        return;
      }
      const reqId = ++listRequestIdRef.current;
      setIsLoading(true);
      setListError(null);
      try {
        const res = await listRemoteWebdavDirectory(
          remoteSettings,
          remoteCredentials,
          targetSubPath
        );
        if (reqId !== listRequestIdRef.current) {
          return;
        }
        if (res.ok) {
          setEntries(res.entries);
        } else {
          setEntries([]);
          setListError(formatRemoteError(res));
        }
      } finally {
        if (reqId === listRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [formatRemoteError, isWebdav, remoteCredentials, remoteSettings]
  );

  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (!justOpened) {
      return;
    }
    const startSubPath = isWebdav ? normalizeRemoteRelativePath(initialSubPath) : '';
    const trimmedInitialLabel = (initialLinkLabel ?? '').trim();
    setCurrentSubPath(startSubPath);
    setFileNameInput(mode === 'save-as' ? initialFileName : '');
    setLinkFormat('relative');
    setLinkLabelInput(trimmedInitialLabel);
    setLinkLabelEdited(trimmedInitialLabel.length > 0);
    setFilterText('');
    setShowAllFiles(false);
    setNewFolderOpen(false);
    setNewFolderName('');
    setListError(null);
    setActionError(null);
    setIsSubmitting(false);
    setIsCreatingFolder(false);
    if (isWebdav) {
      void fetchDirectory(startSubPath);
    } else {
      setEntries([]);
    }
  }, [fetchDirectory, initialFileName, initialLinkLabel, initialSubPath, isOpen, isWebdav, mode]);

  const navigateToFolder = (nextSubPath: string): void => {
    const normalized = normalizeRemoteRelativePath(nextSubPath);
    setCurrentSubPath(normalized);
    setActionError(null);
    if (mode !== 'save-as') {
      setFileNameInput('');
      if (mode === 'insert-link' && !linkLabelEdited) {
        setLinkLabelInput('');
      }
    }
    void fetchDirectory(normalized);
  };

  const breadcrumbs = useMemo(
    () => (currentSubPath ? currentSubPath.split('/') : []),
    [currentSubPath]
  );

  const visibleEntries = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!entry.isDirectory && !showAllFiles && !isSupportedDroppedFileName(entry.name)) {
        return false;
      }
      if (query && !entry.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [entries, filterText, showAllFiles]);

  const resolvedTargetPath = useMemo(() => {
    if (!fileNameInput.trim()) {
      return '';
    }
    return joinRemoteRelativePath(currentSubPath, fileNameInput);
  }, [currentSubPath, fileNameInput]);

  const resolveLinkLabelAndHref = useCallback(
    (targetPath: string): { label: string; href: string } => {
      const baseName = splitRemoteRelativePath(targetPath).fileName || targetPath;
      const label =
        (linkLabelEdited ? linkLabelInput.trim() : '') ||
        stripMarkdownExtension(baseName) ||
        targetPath;
      const href =
        linkFormat === 'webdav-url'
          ? buildRemoteTargetUrl(remoteSettings, targetPath)
          : computeRelativeMarkdownPath(currentRemotePath, targetPath);
      return { label, href };
    },
    [currentRemotePath, linkFormat, linkLabelEdited, linkLabelInput, remoteSettings]
  );

  const linkPreview = useMemo(() => {
    if (mode !== 'insert-link' || !resolvedTargetPath) {
      return '';
    }
    const { label, href } = resolveLinkLabelAndHref(resolvedTargetPath);
    return buildMarkdownLink(label, href, linkFormat === 'webdav-url');
  }, [linkFormat, mode, resolveLinkLabelAndHref, resolvedTargetPath]);

  if (!isOpen) {
    return null;
  }

  const modalTitle =
    mode === 'open'
      ? t.cloudBrowser.openTitle
      : mode === 'save-as'
        ? t.cloudBrowser.saveAsTitle
        : t.cloudBrowser.insertLinkTitle;

  const executePathAction = async (targetPath: string): Promise<void> => {
    if (!targetPath) {
      setActionError(t.cloudBrowser.fileNameRequired);
      return;
    }
    if (mode === 'insert-link') {
      const { label, href } = resolveLinkLabelAndHref(targetPath);
      onInsertLink?.(label, href);
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'open') {
        const res = await loadMarkdownFromRemote(remoteSettings, remoteCredentials, targetPath);
        if (res.ok && typeof res.content === 'string') {
          onOpenedFile(res.remotePath, res.content);
        } else {
          setActionError(t.app.statusRemoteOpenError(formatRemoteError(res)));
        }
      } else {
        const res = await onSaveToPath(targetPath);
        if (!res.ok) {
          setActionError(res.errorText || t.app.statusSaveError);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    void executePathAction(resolvedTargetPath);
  };

  const handleCreateFolder = async (): Promise<void> => {
    const cleanFolder = normalizeRemoteRelativePath(newFolderName).replaceAll('/', '');
    if (!cleanFolder) {
      return;
    }
    setActionError(null);
    setIsCreatingFolder(true);
    try {
      const targetFolder = joinRemoteRelativePath(currentSubPath, cleanFolder);
      const res = await createRemoteWebdavFolder(remoteSettings, remoteCredentials, targetFolder);
      if (res.ok) {
        setNewFolderOpen(false);
        setNewFolderName('');
        await fetchDirectory(currentSubPath);
      } else {
        setActionError(t.cloudBrowser.createFolderError(formatRemoteError(res)));
      }
    } finally {
      setIsCreatingFolder(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="cloud-browser-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>{modalTitle}</h2>
          </div>
          <button
            type="button"
            className="settings-close-icon-btn"
            onClick={onClose}
            aria-label={t.cloudBrowser.closeAria}
          >
            <X size={18} />
          </button>
        </div>

        <div className="cloud-browser-body">
          {isWebdav ? (
            <>
              <div className="cloud-nav-bar">
                <div className="cloud-breadcrumbs">
                  <button
                    type="button"
                    className={`cloud-breadcrumb-btn ${currentSubPath === '' ? 'is-current' : ''}`}
                    onClick={() => navigateToFolder('')}
                  >
                    {t.cloudBrowser.rootLabel}
                  </button>
                  {breadcrumbs.map((segment, index) => {
                    const segPath = breadcrumbs.slice(0, index + 1).join('/');
                    const isCurrent = index === breadcrumbs.length - 1;
                    return (
                      <span key={segPath} className="cloud-breadcrumb-segment">
                        <span className="cloud-breadcrumb-sep">/</span>
                        <button
                          type="button"
                          className={`cloud-breadcrumb-btn ${isCurrent ? 'is-current' : ''}`}
                          onClick={() => navigateToFolder(segPath)}
                        >
                          {segment}
                        </button>
                      </span>
                    );
                  })}
                </div>

                <div className="cloud-nav-actions">
                  <button
                    type="button"
                    className="btn-secondary cloud-nav-btn"
                    disabled={currentSubPath === '' || isLoading}
                    onClick={() =>
                      navigateToFolder(breadcrumbs.slice(0, -1).join('/'))
                    }
                    title={t.cloudBrowser.upFolderBtn}
                  >
                    <ArrowUp size={14} />
                    <span>{t.cloudBrowser.upFolderBtn}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary cloud-nav-btn"
                    disabled={isLoading}
                    onClick={() => void fetchDirectory(currentSubPath)}
                    title={t.cloudBrowser.refreshBtn}
                  >
                    <RefreshCw size={14} />
                    <span>{t.cloudBrowser.refreshBtn}</span>
                  </button>
                  {mode === 'save-as' && (
                    <button
                      type="button"
                      className="btn-secondary cloud-nav-btn"
                      onClick={() => setNewFolderOpen((prev) => !prev)}
                      title={t.cloudBrowser.newFolderBtn}
                    >
                      <FolderPlus size={14} />
                      <span>{t.cloudBrowser.newFolderBtn}</span>
                    </button>
                  )}
                </div>
              </div>

              {newFolderOpen && mode === 'save-as' && (
                <div className="cloud-new-folder-bar">
                  <input
                    type="text"
                    className="settings-input"
                    value={newFolderName}
                    placeholder={t.cloudBrowser.newFolderPlaceholder}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleCreateFolder();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isCreatingFolder || !newFolderName.trim()}
                    onClick={() => void handleCreateFolder()}
                  >
                    {t.cloudBrowser.createFolderSubmit}
                  </button>
                </div>
              )}

              <div className="cloud-filter-bar">
                <input
                  type="text"
                  className="settings-input"
                  value={filterText}
                  placeholder={t.cloudBrowser.filterPlaceholder}
                  onChange={(event) => setFilterText(event.target.value)}
                />
                <label className="settings-checkbox-row cloud-show-all-check">
                  <input
                    type="checkbox"
                    checked={showAllFiles}
                    onChange={(event) => setShowAllFiles(event.target.checked)}
                  />
                  <span>{t.cloudBrowser.showAllFilesLabel}</span>
                </label>
              </div>

              <div className="cloud-entry-list" role="listbox">
                {isLoading ? (
                  <div className="cloud-empty-state">{t.cloudBrowser.loadingList}</div>
                ) : listError ? (
                  <div className="cloud-list-error-box">
                    <div className="settings-alert is-error">{listError}</div>
                    <p className="settings-field-hint">{t.cloudBrowser.listFallbackHint}</p>
                  </div>
                ) : visibleEntries.length === 0 ? (
                  <div className="cloud-empty-state">{t.cloudBrowser.emptyFolder}</div>
                ) : (
                  visibleEntries.map((entry) => {
                    const isSelected =
                      !entry.isDirectory &&
                      resolvedTargetPath !== '' &&
                      resolvedTargetPath === entry.relativePath;
                    return (
                      <button
                        key={`${entry.isDirectory ? 'd' : 'f'}:${entry.relativePath}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`cloud-entry-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          if (entry.isDirectory) {
                            navigateToFolder(entry.relativePath);
                          } else {
                            setFileNameInput(entry.name);
                            if (mode === 'insert-link' && !linkLabelEdited) {
                              setLinkLabelInput(stripMarkdownExtension(entry.name));
                            }
                            setActionError(null);
                          }
                        }}
                        onDoubleClick={() => {
                          if (!entry.isDirectory && (mode === 'open' || mode === 'insert-link')) {
                            void executePathAction(entry.relativePath);
                          }
                        }}
                      >
                        <span className="cloud-entry-icon">
                          {entry.isDirectory ? <Folder size={16} /> : <FileText size={16} />}
                        </span>
                        <span className="cloud-entry-name">{entry.name}</span>
                        <span className="cloud-entry-meta">
                          {entry.isDirectory
                            ? t.cloudBrowser.folderBadge
                            : formatByteSize(entry.size)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="settings-alert is-info">{t.cloudBrowser.customHttpNotice}</div>
          )}

          {actionError && <div className="settings-alert is-error">{actionError}</div>}
        </div>

        <form className="cloud-footer-form" onSubmit={handleSubmit}>
          <label className="settings-field">
            <span className="settings-field-label">{t.cloudBrowser.fileNameField}</span>
            <input
              type="text"
              className="settings-input"
              value={fileNameInput}
              placeholder={t.cloudBrowser.fileNamePlaceholder}
              onChange={(event) => {
                setFileNameInput(event.target.value);
                setActionError(null);
              }}
            />
          </label>
          {mode === 'insert-link' && (
            <div className="cloud-link-options-row">
              <label className="settings-field">
                <span className="settings-field-label">{t.cloudBrowser.linkLabelField}</span>
                <input
                  type="text"
                  className="settings-input"
                  value={linkLabelInput}
                  placeholder={t.cloudBrowser.linkLabelPlaceholder}
                  onChange={(event) => {
                    const nextVal = event.target.value;
                    setLinkLabelInput(nextVal);
                    setLinkLabelEdited(nextVal.trim().length > 0);
                  }}
                />
              </label>
              <label className="settings-field">
                <span className="settings-field-label">{t.cloudBrowser.linkFormatField}</span>
                <select
                  className="settings-input"
                  value={linkFormat}
                  onChange={(event) =>
                    setLinkFormat(
                      event.target.value === 'webdav-url' ? 'webdav-url' : 'relative'
                    )
                  }
                >
                  <option value="relative">{t.cloudBrowser.linkFormatRelative}</option>
                  <option value="webdav-url">{t.cloudBrowser.linkFormatWebdavUrl}</option>
                </select>
              </label>
            </div>
          )}
          <div className="cloud-footer-bottom">
            {mode === 'insert-link' ? (
              <span
                className="cloud-path-preview is-markdown-snippet"
                title={linkPreview || undefined}
              >
                {t.cloudBrowser.linkPreviewLabel} {linkPreview || '-'}
              </span>
            ) : (
              <span className="cloud-path-preview">
                {t.cloudBrowser.targetPathPreviewLabel} /{resolvedTargetPath}
              </span>
            )}
            <div className="cloud-footer-buttons">
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t.cloudBrowser.cancelBtn}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting || !fileNameInput.trim()}
              >
                {mode === 'insert-link' ? <Link2 size={15} /> : <Check size={15} />}
                <span>
                  {mode === 'open'
                    ? isSubmitting
                      ? t.cloudBrowser.openingBtn
                      : t.cloudBrowser.openBtn
                    : mode === 'save-as'
                      ? isSubmitting
                        ? t.cloudBrowser.savingBtn
                        : t.cloudBrowser.saveBtn
                      : t.cloudBrowser.insertLinkBtn}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
