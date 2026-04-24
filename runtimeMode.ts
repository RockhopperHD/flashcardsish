const parseBooleanish = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on', 'offline'].includes(value.toLowerCase());
};

const detectOfflineOnlyMode = (): boolean => {
  const envFlag = parseBooleanish(import.meta.env.VITE_OFFLINE_ONLY);
  if (envFlag) return true;

  const missingGoogleConfig = !import.meta.env.VITE_GOOGLE_CLIENT_ID || !import.meta.env.VITE_GOOGLE_API_KEY;
  if (missingGoogleConfig) {
    return true;
  }

  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (mode && mode.toLowerCase() === 'offline') return true;

  return parseBooleanish(params.get('offline'));
};

export const OFFLINE_ONLY_MODE = detectOfflineOnlyMode();
export const STORAGE_NAMESPACE_SUFFIX = OFFLINE_ONLY_MODE ? '-offline' : '';
