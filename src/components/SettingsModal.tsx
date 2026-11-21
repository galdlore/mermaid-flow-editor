import { useEffect, useRef, useState, type FormEvent } from 'react';
import '../styles/modal-dialogs.css';
import { Check, KeyRound, Lock, ShieldCheck, Trash2, Wifi, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { TAB_SIZE_OPTIONS, type TabSizeOption } from '../utils/markdownTabIndent';
import {
  hasAnyCredentials,
  testRemoteConnection,
  validateRemoteEndpointUrl,
  type EndpointValidationError,
  type RemoteAuthType,
  type RemoteCredentials,
  type RemoteCustomMethod,
  type RemotePayloadFormat,
  type RemoteProtocol,
  type RemoteSaveSettings,
  type SecretPersistenceMode,
} from '../utils/remoteStorage';
import { isWebCryptoAvailable } from '../utils/secretCrypto';
import { isElectronEnv } from '../utils/storage';

export interface SettingsModalProps {
  isOpen: boolean;
  tabSize: TabSizeOption;
  onChangeTabSize: (nextSize: TabSizeOption) => void;
  remoteSettings: RemoteSaveSettings;
  remoteCredentials: RemoteCredentials;
  hasStoredEncryptedCredentials: boolean;
  isCredentialsUnlocked: boolean;
  onUnlockCredentials: (passphrase: string) => Promise<void>;
  onClearStoredCredentials: () => void;
  onSaveSettings: (
    nextSettings: RemoteSaveSettings,
    nextCredentials: RemoteCredentials,
    passphrase?: string
  ) => Promise<void>;
  onClose: () => void;
}

export default function SettingsModal({
  isOpen,
  tabSize,
  onChangeTabSize,
  remoteSettings,
  remoteCredentials,
  hasStoredEncryptedCredentials,
  isCredentialsUnlocked,
  onUnlockCredentials,
  onClearStoredCredentials,
  onSaveSettings,
  onClose,
}: SettingsModalProps) {
  const { t } = useI18n();
  const [draftSettings, setDraftSettings] = useState<RemoteSaveSettings>(remoteSettings);
  const [draftCredentials, setDraftCredentials] = useState<RemoteCredentials>(remoteCredentials);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const webCryptoSupported = isWebCryptoAvailable();
  const isLocked = hasStoredEncryptedCredentials && !isCredentialsUnlocked;
  const prevOpenRef = useRef(false);
  const prevUnlockedRef = useRef(isCredentialsUnlocked);

  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (justOpened) {
      setDraftSettings(remoteSettings);
      setDraftCredentials(remoteCredentials);
      setPassphrase('');
      setPassphraseConfirm('');
      setUnlockPassphrase('');
      setFormError(null);
      setNoticeMessage(null);
      setTestResult(null);
    }
  }, [isOpen, remoteSettings, remoteCredentials]);

  useEffect(() => {
    const justUnlocked = !prevUnlockedRef.current && isCredentialsUnlocked;
    prevUnlockedRef.current = isCredentialsUnlocked;
    if (isOpen && justUnlocked) {
      setDraftCredentials(remoteCredentials);
    }
  }, [isOpen, isCredentialsUnlocked, remoteCredentials]);

  if (!isOpen) {
    return null;
  }

  const getEndpointErrorMessage = (code: EndpointValidationError): string => {
    if (code === 'empty') {
      return t.settings.endpointErrorEmpty;
    }
    if (code === 'invalid-protocol') {
      return t.settings.endpointErrorProtocol;
    }
    if (code === 'relative-not-allowed') {
      return t.settings.endpointErrorRelative;
    }
    return t.settings.endpointErrorInvalid;
  };

  const handleUnlock = async (): Promise<void> => {
    setFormError(null);
    setNoticeMessage(null);
    if (!unlockPassphrase) {
      setFormError(t.settings.secretUnlockError);
      return;
    }
    setIsUnlocking(true);
    try {
      await onUnlockCredentials(unlockPassphrase);
      setUnlockPassphrase('');
      setNoticeMessage(t.settings.secretUnlockedNotice);
    } catch {
      setFormError(t.settings.secretUnlockError);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleClearStored = (): void => {
    onClearStoredCredentials();
    setUnlockPassphrase('');
    setPassphrase('');
    setPassphraseConfirm('');
    setFormError(null);
    setNoticeMessage(t.settings.secretClearedNotice);
  };

  const handleTestConnection = async (): Promise<void> => {
    setFormError(null);
    setTestResult(null);

    const validationError = validateRemoteEndpointUrl(draftSettings.endpointUrl, !isElectronEnv());
    if (validationError) {
      setTestResult({ ok: false, text: getEndpointErrorMessage(validationError) });
      return;
    }

    if (isLocked && !hasAnyCredentials(draftCredentials, draftSettings.authType)) {
      setTestResult({ ok: false, text: t.app.statusRemoteLocked });
      return;
    }

    setIsTesting(true);
    try {
      const result = await testRemoteConnection(draftSettings, draftCredentials);
      if (result.ok) {
        setTestResult({ ok: true, text: t.settings.testSuccess(result.status) });
      } else if (result.permissionDenied) {
        setTestResult({ ok: false, text: t.app.statusRemotePermissionDenied });
      } else if (result.isCorsOrNetworkError) {
        setTestResult({ ok: false, text: t.app.statusRemoteCorsHint });
      } else {
        setTestResult({
          ok: false,
          text: t.settings.testFailed(result.error || `HTTP ${result.status}`),
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const credentialsModified =
    draftCredentials.username !== remoteCredentials.username ||
    draftCredentials.password !== remoteCredentials.password ||
    draftCredentials.bearerToken !== remoteCredentials.bearerToken;

  const needsPassphraseEntry =
    draftSettings.enabled &&
    draftSettings.authType !== 'none' &&
    draftSettings.secretPersistence === 'encrypted' &&
    (!hasStoredEncryptedCredentials || credentialsModified || passphrase.length > 0);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    if (draftSettings.enabled) {
      const validationError = validateRemoteEndpointUrl(draftSettings.endpointUrl, !isElectronEnv());
      if (validationError) {
        setFormError(getEndpointErrorMessage(validationError));
        return;
      }
    }

    if (needsPassphraseEntry) {
      if (!passphrase) {
        setFormError(t.settings.secretPassphraseRequired);
        return;
      }
      if (passphrase !== passphraseConfirm) {
        setFormError(t.settings.secretPassphraseMismatch);
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSaveSettings(
        draftSettings,
        draftCredentials,
        needsPassphraseEntry ? passphrase : undefined
      );
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.app.statusSaveError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.settings.modalTitle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="settings-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>{t.settings.modalTitle}</h2>
          </div>
          <button
            type="button"
            className="settings-close-icon-btn"
            onClick={onClose}
            aria-label={t.settings.modalCloseAria}
          >
            <X size={18} />
          </button>
        </div>

        <form className="settings-modal-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="settings-modal-body">
            <section className="settings-section">
              <h3 className="settings-section-title">{t.settings.generalSectionTitle}</h3>
              <label className="settings-field">
                <span className="settings-field-label">{t.settings.tabSizeField}</span>
                <select
                  className="settings-input"
                  value={tabSize}
                  onChange={(event) =>
                    onChangeTabSize(Number(event.target.value) === 4 ? 4 : 2)
                  }
                >
                  {TAB_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {t.editor.tabSpacesOption(size)}
                    </option>
                  ))}
                </select>
                <span className="settings-field-hint">{t.settings.tabSizeHint}</span>
              </label>
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">{t.settings.cloudSectionTitle}</h3>

              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={draftSettings.enabled}
                  onChange={(event) =>
                    setDraftSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                  }
                />
                <span>{t.settings.cloudEnabledLabel}</span>
              </label>

              {isLocked && (
                <div className="settings-lock-panel">
                  <div className="settings-lock-header">
                    <Lock size={15} />
                    <strong>{t.settings.secretLockedTitle}</strong>
                  </div>
                  <p className="settings-field-hint">{t.settings.secretLockedHint}</p>
                  <div className="settings-lock-actions">
                    <input
                      type="password"
                      className="settings-input"
                      value={unlockPassphrase}
                      placeholder={t.settings.secretPassphraseField}
                      onChange={(event) => setUnlockPassphrase(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isUnlocking}
                      onClick={() => void handleUnlock()}
                    >
                      <KeyRound size={14} />
                      <span>{t.settings.secretUnlockBtn}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary settings-danger-btn"
                      onClick={handleClearStored}
                    >
                      <Trash2 size={14} />
                      <span>{t.settings.secretClearBtn}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="settings-grid-two">
                <label className="settings-field">
                  <span className="settings-field-label">{t.settings.cloudProtocolField}</span>
                  <select
                    className="settings-input"
                    value={draftSettings.protocol}
                    onChange={(event) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        protocol: event.target.value as RemoteProtocol,
                      }))
                    }
                  >
                    <option value="webdav">{t.settings.cloudProtocolWebdav}</option>
                    <option value="custom-http">{t.settings.cloudProtocolCustom}</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span className="settings-field-label">{t.settings.cloudAuthTypeField}</span>
                  <select
                    className="settings-input"
                    value={draftSettings.authType}
                    onChange={(event) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        authType: event.target.value as RemoteAuthType,
                      }))
                    }
                  >
                    <option value="basic">{t.settings.cloudAuthBasic}</option>
                    <option value="bearer">{t.settings.cloudAuthBearer}</option>
                    <option value="none">{t.settings.cloudAuthNone}</option>
                  </select>
                </label>
              </div>

              <label className="settings-field">
                <span className="settings-field-label">{t.settings.cloudEndpointField}</span>
                <input
                  type="text"
                  className="settings-input"
                  value={draftSettings.endpointUrl}
                  placeholder={
                    draftSettings.protocol === 'webdav'
                      ? t.settings.cloudEndpointPlaceholderWebdav
                      : t.settings.cloudEndpointPlaceholderCustom
                  }
                  onChange={(event) =>
                    setDraftSettings((prev) => ({ ...prev, endpointUrl: event.target.value }))
                  }
                />
                <span className="settings-field-hint">
                  {draftSettings.protocol === 'webdav'
                    ? t.settings.cloudEndpointHintWebdav
                    : t.settings.cloudEndpointHintCustom}
                </span>
              </label>

              {draftSettings.protocol === 'custom-http' && (
                <div className="settings-grid-two">
                  <label className="settings-field">
                    <span className="settings-field-label">{t.settings.cloudMethodField}</span>
                    <select
                      className="settings-input"
                      value={draftSettings.customMethod}
                      onChange={(event) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          customMethod: event.target.value as RemoteCustomMethod,
                        }))
                      }
                    >
                      <option value="PUT">PUT</option>
                      <option value="POST">POST</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span className="settings-field-label">{t.settings.cloudPayloadField}</span>
                    <select
                      className="settings-input"
                      value={draftSettings.payloadFormat}
                      onChange={(event) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          payloadFormat: event.target.value as RemotePayloadFormat,
                        }))
                      }
                    >
                      <option value="raw">{t.settings.cloudPayloadRaw}</option>
                      <option value="json">{t.settings.cloudPayloadJson}</option>
                    </select>
                  </label>
                </div>
              )}

              {draftSettings.authType === 'basic' && (
                <div className="settings-grid-two">
                  <label className="settings-field">
                    <span className="settings-field-label">{t.settings.cloudUsernameField}</span>
                    <input
                      type="text"
                      className="settings-input"
                      autoComplete="off"
                      value={draftCredentials.username}
                      onChange={(event) =>
                        setDraftCredentials((prev) => ({ ...prev, username: event.target.value }))
                      }
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">{t.settings.cloudPasswordField}</span>
                    <input
                      type="password"
                      className="settings-input"
                      autoComplete="new-password"
                      value={draftCredentials.password}
                      onChange={(event) =>
                        setDraftCredentials((prev) => ({ ...prev, password: event.target.value }))
                      }
                    />
                  </label>
                </div>
              )}

              {draftSettings.authType === 'bearer' && (
                <label className="settings-field">
                  <span className="settings-field-label">{t.settings.cloudTokenField}</span>
                  <input
                    type="password"
                    className="settings-input"
                    autoComplete="off"
                    value={draftCredentials.bearerToken}
                    onChange={(event) =>
                      setDraftCredentials((prev) => ({ ...prev, bearerToken: event.target.value }))
                    }
                  />
                </label>
              )}

              {draftSettings.authType !== 'none' && (
                <div className="settings-subsection">
                  <label className="settings-field">
                    <span className="settings-field-label">{t.settings.secretPersistenceField}</span>
                    <select
                      className="settings-input"
                      value={draftSettings.secretPersistence}
                      onChange={(event) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          secretPersistence: event.target.value as SecretPersistenceMode,
                        }))
                      }
                    >
                      <option value="memory">{t.settings.secretPersistenceMemory}</option>
                      <option value="encrypted" disabled={!webCryptoSupported}>
                        {t.settings.secretPersistenceEncrypted}
                      </option>
                    </select>
                    <span className="settings-field-hint">
                      {!webCryptoSupported
                        ? t.settings.secretCryptoUnavailable
                        : draftSettings.secretPersistence === 'encrypted'
                          ? t.settings.secretEncryptedHint
                          : t.settings.secretMemoryHint}
                    </span>
                  </label>

                  {draftSettings.secretPersistence === 'encrypted' && webCryptoSupported && (
                    <div className="settings-grid-two">
                      <label className="settings-field">
                        <span className="settings-field-label">
                          {t.settings.secretPassphraseField}
                        </span>
                        <input
                          type="password"
                          className="settings-input"
                          autoComplete="new-password"
                          value={passphrase}
                          onChange={(event) => setPassphrase(event.target.value)}
                        />
                      </label>
                      <label className="settings-field">
                        <span className="settings-field-label">
                          {t.settings.secretPassphraseConfirmField}
                        </span>
                        <input
                          type="password"
                          className="settings-input"
                          autoComplete="new-password"
                          value={passphraseConfirm}
                          onChange={(event) => setPassphraseConfirm(event.target.value)}
                        />
                      </label>
                    </div>
                  )}

                  {hasStoredEncryptedCredentials && !isLocked && (
                    <div className="settings-stored-badge-row">
                      <span className="settings-stored-badge">
                        <ShieldCheck size={14} />
                        <span>{t.settings.secretUnlockedNotice}</span>
                      </span>
                      <button
                        type="button"
                        className="btn-secondary settings-danger-btn"
                        onClick={handleClearStored}
                      >
                        <Trash2 size={14} />
                        <span>{t.settings.secretClearBtn}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={draftSettings.syncWithLocalSave}
                  onChange={(event) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      syncWithLocalSave: event.target.checked,
                    }))
                  }
                />
                <span>{t.settings.cloudSyncOnSaveLabel}</span>
              </label>
              <span className="settings-field-hint">{t.settings.cloudSyncOnSaveHint}</span>

              <div className="settings-test-row">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isTesting}
                  onClick={() => void handleTestConnection()}
                >
                  <Wifi size={14} />
                  <span>
                    {isTesting ? t.settings.testingConnectionBtn : t.settings.testConnectionBtn}
                  </span>
                </button>
                {testResult && (
                  <span className={`settings-test-status ${testResult.ok ? 'is-ok' : 'is-error'}`}>
                    {testResult.text}
                  </span>
                )}
              </div>
            </section>

            {noticeMessage && <div className="settings-alert is-info">{noticeMessage}</div>}
            {formError && <div className="settings-alert is-error">{formError}</div>}
          </div>

          <div className="settings-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t.settings.cancelBtn}
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              <Check size={15} />
              <span>{t.settings.saveBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
