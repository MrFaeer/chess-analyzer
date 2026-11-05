import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, errorKey } from './auth';
import { usePreferences } from './preferences';
import type { MessageKey } from './i18n';

export function AccountPage() {
  const { user, logout, error: authError } = useAuth();
  const { t } = usePreferences();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  if (!user) return null;
  return <main id="main" className="wrap auth-shell"><section className="auth-card" aria-labelledby="account-title">
    <span className="eyebrow">Chess Analyzer</span><h1 id="account-title">{t('accountTitle')}</h1>
    <dl className="account-details"><dt>{t('loginLabel')}</dt><dd>{user.login}</dd><dt>{t('emailLabel')}</dt><dd>{user.email ?? '—'}</dd></dl>
    {user.email && !user.emailVerifiedAt && <p>{t('emailUnverified')}</p>}
    <p>{t('accountEmpty')}</p>
    <div className="actions"><button className="button primary" disabled={busy} onClick={async () => {
      setBusy(true); setError(null);
      try { await logout(); navigate('/', { replace: true }); }
      catch (failure) { setError(errorKey(failure)); }
      finally { setBusy(false); }
    }}>{t(busy ? 'submitting' : 'logout')}</button><Link className="button secondary" to="/">{t('close')}</Link></div>
    {(error || authError) && <p className="form-error" role="alert">{t((error ?? authError)!)}</p>}
  </section></main>;
}
