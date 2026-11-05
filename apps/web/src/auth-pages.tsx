import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errorKey, useAuth } from './auth';
import { usePreferences } from './preferences';
import type { MessageKey } from './i18n';

export function SessionStatus() {
  const { status, error, reload } = useAuth();
  const { t } = usePreferences();
  return <main id="main" className="wrap auth-shell" aria-live="polite"><div className="auth-card"><p role={status === 'error' ? 'alert' : 'status'}>{t(status === 'loading' ? 'checkingSession' : error ?? 'unexpectedError')}</p>{status === 'error' && <button className="button primary" onClick={reload}>{t('retry')}</button>}</div></main>;
}

export function ProtectedPage({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status !== 'ready') return <SessionStatus />;
  return user ? children : <Navigate to="/login" replace />;
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, status, signIn } = useAuth();
  const { t, language } = usePreferences();
  const navigate = useNavigate();
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';
  if (status !== 'ready') return <SessionStatus />;
  if (user) return <Navigate to="/app" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setError(null);
    if (register && data.password !== data.confirmPassword) { setError('passwordMismatch'); return; }
    setBusy(true);
    try {
      await signIn(mode, { ...data, language });
      form.reset();
      navigate('/app', { replace: true });
    } catch (failure) { setError(errorKey(failure)); }
    finally { setBusy(false); }
  }

  return <main id="main" className="wrap auth-shell"><section className="auth-card" aria-labelledby="auth-title">
    <span className="eyebrow">Chess Analyzer</span><h1 id="auth-title">{t(mode)}</h1>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label htmlFor="identifier">{t(register ? 'loginLabel' : 'identifierLabel')}</label>
        <input id="identifier" name={register ? 'login' : 'identifier'} autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={register ? 3 : 1} maxLength={register ? 32 : 254} pattern={register ? '[A-Za-z0-9_]{3,32}' : undefined} aria-describedby={register ? 'login-help' : undefined} />
        {register && <><p id="login-help" className="field-help">{t('loginHelp')}</p><label htmlFor="email">{t('emailLabel')}</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required /></>}
        <label htmlFor="password">{t('passwordLabel')}</label>
        <input id="password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 15 : 1} maxLength={128} required aria-describedby={register ? 'password-help' : undefined} />
        {register && <><p id="password-help" className="field-help">{t('passwordHelp')}</p><label htmlFor="confirm-password">{t('confirmPasswordLabel')}</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={15} maxLength={128} required /></>}
        <button className="button primary auth-submit" type="submit">{t(busy ? 'submitting' : mode)}</button>
      </fieldset>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
    </form>
    <p className="auth-alternative">{t(register ? 'alreadyRegistered' : 'needAccount')} <Link to={register ? '/login' : '/register'}>{t(register ? 'login' : 'register')}</Link></p>
    <Link className="text-link" to="/">{t('close')}</Link>
  </section></main>;
}
