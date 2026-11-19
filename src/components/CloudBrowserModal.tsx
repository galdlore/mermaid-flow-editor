import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUp,
  Check,
  FileText,
  Folder,
  FolderPlus,
  RefreshCw,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { isSupportedDroppedFileName } from '../utils/documentTabs';
import {
  createRemoteWebdavFolder,
  joinRemoteRelativePath,
  listRemoteWebdavDirectory,
  loadMarkdownFromRemote,
  normalizeRemoteRelativePath,
  type RemoteCredentials,
  type RemoteDirectoryEntry,
  type RemoteRequestResult,
  type RemoteSaveSettings,
} from '../utils/remoteStorage';

export interface CloudBrowserModalProps {
  isOpen: boolean;
  mode: 'open' | 'save-as';
  remoteSettings: RemoteSaveSettings;
  remoteCredentials: RemoteCredentials;
  initialSubPath: string;
  initialFileName: string;
  onOpenedFile: (remotePath: string, content: string) => void;
  onSaveToPath: (remotePath: string) => Promise<{ ok: boolean; errorText?: string }>;
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
  onOpenedFile,
  onSaveToPath,
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
    setCurrentSubPath(startSubPath);
    setFileNameInput(mode === 'save-as' ? initialFileName : '');
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
  }, [fetchDirectory, initialFileName, initialSubPath, isOpen, isWebdav, mode]);

  const navigateToFolder = (nextSubPath: string): void => {
    const normalized = normalizeRemoteRelativePath(nextSubPath);
    setCurrentSubPath(normalized);
    setActionError(null);
    if (mode === 'open') {
      setFileNameInput('');
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

  if (!isOpen) {
    return null;
  }

  const executePathAction = async (targetPath: string): Promise<void> => {
    if (!targetPath) {
      setActionError(t.cloudBrowser.fileNameRequired);
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
      aria-label={mode === 'open' ? t.cloudBrowser.openTitle : t.cloudBrowser.saveAsTitle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="cloud-browser-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>{mode === 'open' ? t.cloudBrowser.openTitle : t.cloudBrowser.saveAsTitle}</h2>
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
                            setActionError(null);
                          }
                        }}
                        onDoubleClick={() => {
                          if (!entry.isDirectory && mode === 'open') {
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
          <div className="cloud-footer-bottom">
            <span className="cloud-path-preview">
              {t.cloudBrowser.targetPathPreviewLabel} /{resolvedTargetPath}
            </span>
            <div className="cloud-footer-buttons">
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t.cloudBrowser.cancelBtn}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting || !fileNameInput.trim()}
              >
                <Check size={15} />
                <span>
                  {mode === 'open'
                    ? isSubmitting
                      ? t.cloudBrowser.openingBtn
                      : t.cloudBrowser.openBtn
                    : isSubmitting
                      ? t.cloudBrowser.savingBtn
                      : t.cloudBrowser.saveBtn}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
