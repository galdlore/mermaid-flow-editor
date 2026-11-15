/** 実行環境がElectronレンダラーかどうかを判定する */
export function isElectronEnv(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
}

/** localStorageから安全に文字列を読み出す */
export function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** localStorageへ安全に文字列を書き込む */
export function writeLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ストレージ容量超過やアクセス拒否は無視する
  }
}
