import { useCallback, useState } from 'react';
import type { TranslationCatalog } from '../locales/types';
import {
  clearEncryptedCredentials,
  createEmptyRemoteCredentials,
  hasAnyCredentials,
  hasEncryptedCredentials,
  loadRemoteSettings,
  saveEncryptedCredentials,
  saveRemoteSettings,
  unlockEncryptedCredentials,
  type RemoteCredentials,
  type RemoteRequestResult,
  type RemoteSaveSettings,
} from '../utils/remoteStorage';

interface UseCloudStorageOptions {
  t: TranslationCatalog;
  onStatusMessage: (message: string | null) => void;
}

export function useCloudStorage({ t, onStatusMessage }: UseCloudStorageOptions) {
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [cloudBrowserMode, setCloudBrowserMode] = useState<'open' | 'save-as' | null>(null);
  const [remoteSettings, setRemoteSettings] = useState<RemoteSaveSettings>(() =>
    loadRemoteSettings()
  );
  const [remoteCredentials, setRemoteCredentials] = useState<RemoteCredentials>(() =>
    createEmptyRemoteCredentials()
  );
  const [hasStoredSecret, setHasStoredSecret] = useState<boolean>(() =>
    hasEncryptedCredentials()
  );
  const [isSecretUnlocked, setIsSecretUnlocked] = useState(false);

  const formatRemoteFailureMessage = useCallback(
    (result: RemoteRequestResult): string => {
      if (result.permissionDenied) {
        return t.app.statusRemotePermissionDenied;
      }
      if (result.isCorsOrNetworkError) {
        return t.app.statusRemoteCorsHint;
      }
      return t.app.statusRemoteSaveError(result.error || `HTTP ${result.status}`);
    },
    [t]
  );

  const isRemoteLocked = useCallback(
    (settings: RemoteSaveSettings, creds: RemoteCredentials): boolean =>
      settings.authType !== 'none' &&
      hasStoredSecret &&
      !isSecretUnlocked &&
      !hasAnyCredentials(creds, settings.authType),
    [hasStoredSecret, isSecretUnlocked]
  );

  const handleUnlockRemoteCredentials = useCallback(async (passphrase: string) => {
    const decrypted = await unlockEncryptedCredentials(passphrase);
    setRemoteCredentials(decrypted);
    setIsSecretUnlocked(true);
  }, []);

  const handleClearStoredRemoteCredentials = useCallback(() => {
    clearEncryptedCredentials();
    setHasStoredSecret(false);
    setIsSecretUnlocked(false);
  }, []);

  const handleSaveSettingsModal = useCallback(
    async (
      nextSettings: RemoteSaveSettings,
      nextCredentials: RemoteCredentials,
      passphrase?: string
    ) => {
      saveRemoteSettings(nextSettings);
      setRemoteSettings(nextSettings);
      setRemoteCredentials(nextCredentials);

      if (nextSettings.secretPersistence === 'encrypted' && nextSettings.authType !== 'none') {
        if (passphrase) {
          await saveEncryptedCredentials(nextCredentials, passphrase);
          setHasStoredSecret(true);
          setIsSecretUnlocked(true);
        }
      } else if (hasEncryptedCredentials()) {
        clearEncryptedCredentials();
        setHasStoredSecret(false);
        setIsSecretUnlocked(false);
      }
    },
    []
  );

  const ensureRemoteReadyForAction = useCallback((): boolean => {
    if (!remoteSettings.enabled || !remoteSettings.endpointUrl.trim()) {
      onStatusMessage(t.app.statusRemoteNotConfigured);
      setSettingsModalOpen(true);
      return false;
    }
    if (isRemoteLocked(remoteSettings, remoteCredentials)) {
      onStatusMessage(t.app.statusRemoteLocked);
      setSettingsModalOpen(true);
      return false;
    }
    return true;
  }, [isRemoteLocked, onStatusMessage, remoteCredentials, remoteSettings, t]);

  const openCloudBrowser = useCallback(
    (mode: 'open' | 'save-as') => {
      if (!ensureRemoteReadyForAction()) {
        return;
      }
      setCloudBrowserMode(mode);
    },
    [ensureRemoteReadyForAction]
  );

  return {
    settingsModalOpen,
    setSettingsModalOpen,
    cloudBrowserMode,
    setCloudBrowserMode,
    remoteSettings,
    remoteCredentials,
    hasStoredSecret,
    isSecretUnlocked,
    isRemoteLocked,
    formatRemoteFailureMessage,
    handleUnlockRemoteCredentials,
    handleClearStoredRemoteCredentials,
    handleSaveSettingsModal,
    ensureRemoteReadyForAction,
    openCloudBrowser,
  };
}
