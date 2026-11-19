import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import {
  createDefaultRemoteSettings,
  createEmptyRemoteCredentials,
} from '../utils/remoteStorage';
import SettingsModal from './SettingsModal';

describe('SettingsModal', () => {
  it('allows changing tab size, validates empty URL and passphrase mismatch', async () => {
    const onChangeTabSize = vi.fn();
    const onSaveSettings = vi.fn().mockResolvedValue(undefined);

    render(
      <I18nProvider>
        <SettingsModal
          isOpen
          tabSize={2}
          onChangeTabSize={onChangeTabSize}
          remoteSettings={createDefaultRemoteSettings()}
          remoteCredentials={createEmptyRemoteCredentials()}
          hasStoredEncryptedCredentials={false}
          isCredentialsUnlocked={false}
          onUnlockCredentials={vi.fn().mockResolvedValue(undefined)}
          onClearStoredCredentials={vi.fn()}
          onSaveSettings={onSaveSettings}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    const tabSelect = screen.getByLabelText(/2ペイン編集のTabインデント幅/);
    fireEvent.change(tabSelect, { target: { value: '4' } });
    expect(onChangeTabSize).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByLabelText('クラウド保存を有効にする'));
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }));
    expect(await screen.findByText('保存先のURLを入力してください。')).toBeInTheDocument();
    expect(onSaveSettings).not.toHaveBeenCalled();

    const urlInput = screen.getByLabelText(/保存先フォルダURL/);
    fireEvent.change(urlInput, { target: { value: 'https://cloud.local/dav/' } });

    const persistenceSelect = screen.getByLabelText(/認証情報の保持方法/);
    fireEvent.change(persistenceSelect, { target: { value: 'encrypted' } });

    fireEvent.change(screen.getByLabelText('暗号化パスフレーズ（復号鍵）'), {
      target: { value: 'key-123' },
    });
    fireEvent.change(screen.getByLabelText('暗号化パスフレーズ（確認用）'), {
      target: { value: 'mismatch' },
    });
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }));

    expect(await screen.findByText('確認用のパスフレーズが一致しません。')).toBeInTheDocument();
    expect(onSaveSettings).not.toHaveBeenCalled();
  });

  it('shows unlock panel when encrypted credentials are locked and calls onUnlockCredentials', async () => {
    const onUnlockCredentials = vi.fn().mockResolvedValue(undefined);

    render(
      <I18nProvider>
        <SettingsModal
          isOpen
          tabSize={2}
          onChangeTabSize={vi.fn()}
          remoteSettings={{
            ...createDefaultRemoteSettings(),
            enabled: true,
            endpointUrl: 'https://cloud.local/dav/',
            secretPersistence: 'encrypted',
          }}
          remoteCredentials={createEmptyRemoteCredentials()}
          hasStoredEncryptedCredentials
          isCredentialsUnlocked={false}
          onUnlockCredentials={onUnlockCredentials}
          onClearStoredCredentials={vi.fn()}
          onSaveSettings={vi.fn().mockResolvedValue(undefined)}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText('保存済みの暗号化認証情報があります')).toBeInTheDocument();

    const passphraseInput = screen.getByPlaceholderText('暗号化パスフレーズ（復号鍵）');
    fireEvent.change(passphraseInput, { target: { value: 'my-secret-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'ロック解除' }));

    await waitFor(() => {
      expect(onUnlockCredentials).toHaveBeenCalledWith('my-secret-key');
    });
    expect(await screen.findByText('認証情報のロックを解除しました。')).toBeInTheDocument();
  });
});
