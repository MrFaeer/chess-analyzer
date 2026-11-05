import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isLanguage, type Language, type MessageKey } from './i18n';
import { usePreferences } from './preferences';

export type User = { id: string; login: string; email: string | null; emailVerifiedAt: string | null; language: Language };
const errorKeys = ['invalidInput', 'invalidLogin', 'invalidEmail', 'invalidPassword', 'passwordMismatch', 'invalidCredentials', 'accountExists', 'rateLimited', 'requestRejected', 'sessionExpired', 'networkError', 'unexpectedError'] as const;
export class ApiError extends Error {
  constructor(readonly code: MessageKey) { super(code); }
}

export async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method, credentials: 'same-origin', signal,
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('networkError');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { code?: string } | null;
    const code = errorKeys.find(key => key === payload?.code);
    throw new ApiError(code ?? (response.status === 401 ? 'sessionExpired' : response.status === 429 ? 'rateLimited' : 'unexpectedError'));
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function errorKey(error: unknown): MessageKey { return error instanceof ApiError ? error.code : 'unexpectedError'; }
type Auth = {
  user: User | null;
  status: 'loading' | 'ready' | 'error';
  error: MessageKey | null;
  savingLanguage: boolean;
  reload: () => void;
  signIn: (path: 'login' | 'register', data: unknown) => Promise<void>;
  logout: () => Promise<void>;
  changeLanguage: (language: Language) => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLanguage } = usePreferences();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Auth['status']>('loading');
  const [error, setError] = useState<MessageKey | null>(null);
  const [revision, setRevision] = useState(0);
  const [savingLanguage, setSavingLanguage] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    void api<User>('me', 'GET', undefined, controller.signal).then(current => {
      if (controller.signal.aborted) return;
      setUser(current);
      if (isLanguage(current.language)) setLanguage(current.language);
      setStatus('ready');
    }).catch((failure: unknown) => {
      if (controller.signal.aborted) return;
      setUser(null);
      if (failure instanceof ApiError && failure.code === 'sessionExpired') setStatus('ready');
      else { setError(errorKey(failure)); setStatus('error'); }
    });
    return () => controller.abort();
    // Preferences must not restart session restoration when the language changes.
  }, [revision]);

  async function signIn(path: 'login' | 'register', data: unknown) {
    const current = await api<User>(path, 'POST', data);
    setUser(current); setStatus('ready'); setError(null);
    if (isLanguage(current.language)) setLanguage(current.language);
  }

  async function logout() {
    try { await api<void>('logout', 'POST', {}); }
    catch (failure) { setError(errorKey(failure)); throw failure; }
    setUser(null); setStatus('ready'); setError(null);
  }

  async function changeLanguage(language: Language) {
    setLanguage(language);
    if (!user) return;
    setSavingLanguage(true); setError(null);
    try { setUser(await api<User>('preferences', 'PATCH', { language })); }
    catch (failure) {
      setError(errorKey(failure));
      if (failure instanceof ApiError && failure.code === 'sessionExpired') setUser(null);
    } finally { setSavingLanguage(false); }
  }

  return <AuthContext.Provider value={{ user, status, error, savingLanguage, reload: () => setRevision(value => value + 1), signIn, logout, changeLanguage }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}
