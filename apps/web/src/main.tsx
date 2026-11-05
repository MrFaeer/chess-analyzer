import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { languages, type MessageKey } from './i18n';
import { PreferencesProvider, usePreferences } from './preferences';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { AuthPage, ProtectedPage } from './auth-pages';
import { AccountPage } from './account-page';
import './style.css';

const features: { title: MessageKey; description: MessageKey }[] = [
  { title: 'historyTitle', description: 'historyDescription' },
  { title: 'statisticsTitle', description: 'statisticsDescription' },
  { title: 'ratingTitle', description: 'ratingDescription' },
  { title: 'analysisTitle', description: 'analysisDescription' },
];

function FeatureArtwork({ index }: { index: number }) {
  const pieces = [
    'M130 38h10v10h10V38h10v10h10V38h10v30h-10v34h10v10h10v10h-70v-10h10v-10h10V68h-10Z',
    'M150 32h10v10h10v20h10v10h-10v10h-10v20h20v10h10v10h-70v-10h10v-10h20V82h-10V72h-10V62h10V42h10Z',
    'M140 38h20v10h10v10h10v30h-10v14h10v10h10v10h-70v-10h10v-20h10V72h-10V62h-10V52h20Z',
    'M150 28h10v12h12v10h-12v12h20v10h-10v30h10v10h10v10h-70v-10h10v-10h10V72h-10V62h20V50h-12V40h12Z',
  ];
  return <div className="feature-art" aria-hidden="true"><svg viewBox="0 0 300 140" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" focusable="false">
    <path className="pixel-cloud" d="M26 26h20v-7h28v7h22v8H26Zm175 23h20v-8h26v8h21v7h-67Z" />
    <path className="pixel-sun" d={index % 2 ? 'M250 15h26v26h-26Z' : 'M241 20h23v23h-23Z'} />
    <path className="pixel-back" d="M0 96h20V83h25V70h25v13h25v15h22V85h27V73h28v14h20V74h26V60h25v15h25v12h32v53H0Z" />
    <path className="pixel-middle" d="M0 118h27v-12h27V94h24v15h27v16h28v-14h31v-12h21v14h27v-12h25v13h31v-10h32v36H0Z" />
    <path className="pixel-piece-shadow" d={pieces[index]} transform="translate(8 7)" />
    <path className="pixel-piece" d={pieces[index]} />
    <path className="pixel-ground" d="M0 133h38v-9h34v6h37v-7h89v7h37v-10h30v8h35v12H0Z" />
    <path className="pixel-spark" d="M108 41h3v3h-3Zm91-19h3v3h-3ZM64 57h3v3h-3Zm163 32h3v3h-3Z" />
  </svg></div>;
}
function AvailabilityNotice({ message, onClose }: { message: MessageKey; onClose: () => void }) {
  const { t } = usePreferences();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} onClose={() => { if (!ref.current?.open) onClose(); }} aria-labelledby="notice-title" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content"><span className="eyebrow">{t('unavailable')}</span><h2 id="notice-title">{t(message)}</h2><p>{t('noticeDescription')}</p><form method="dialog"><button autoFocus className="button primary">{t('close')}</button></form></div>
  </dialog>;
}

function App() {
  const { language, theme, setTheme, t } = usePreferences();
  const { user, changeLanguage, savingLanguage } = useAuth();
  const [notice, setNotice] = useState<MessageKey | null>(null);
  return <>
    <a className="skip-link" href="#main">{t('skipLink')}</a>
    <header className="header wrap">
      <a className="brand" href="/" aria-label="Chess Analyzer"><span className="brand-icon" aria-hidden="true">♞</span><span>Chess<span className="brand-light">Analyzer</span></span><span className="beta">{t('alphaLabel')}</span></a>
      <nav aria-label={t('navigationLabel')}><a href="/#features">{t('featuresLink')}</a><a href="/#availability">{t('availabilityLink')}</a></nav>
      <div className="preferences">
        <div className="language-switch" data-language={language} role="group" aria-label={t('languageLabel')}>
          {languages.map((value) => <button key={value} type="button" lang={value} aria-pressed={language === value} title={{ en: 'English', ru: 'Русский', lv: 'Latviešu' }[value]} disabled={savingLanguage} onClick={() => void changeLanguage(value)}>{value.toUpperCase()}</button>)}
        </div>
        <button className="theme-button" type="button" onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setTheme(theme === 'dark' ? 'light' : 'dark', { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
        }} aria-label={theme === 'dark' ? t('lightTheme') : t('darkTheme')} title={theme === 'dark' ? t('lightTheme') : t('darkTheme')}>
          <svg className="theme-icon" data-theme={theme} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <g className="theme-sun"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></g>
            <path className="theme-moon" d="M20.9 13.3A9 9 0 0 1 10.7 3.1 9 9 0 1 0 20.9 13.3Z" />
          </svg>
        </button>
        <Link className="login-button" to={user ? '/app' : '/login'}>{t(user ? 'openAccount' : 'login')}</Link>
      </div>
    </header>
    <Routes><Route path="/" element={<main id="main" className="wrap">
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <span className="eyebrow"><span className="status-dot" />{t('eyebrow')}</span>
          <h1 id="hero-heading">{t('heading')}<br /><span>{t('headingAccent')}</span></h1>
          <p className="intro">{t('introduction')}</p>
          <div className="actions"><Link className="button primary" to={user ? '/app' : '/register'}>{t(user ? 'openAccount' : 'register')} <span aria-hidden="true">↗</span></Link><button className="button secondary" onClick={() => setNotice('demoNotice')}>{t('demo')} <span aria-hidden="true">→</span></button></div>
          <p className="action-note">{t('actionNote')}</p>
          <div className="platforms"><span>{t('platformLabel')}</span><strong>Lichess</strong><span className="divider" /><strong>Chess.com</strong></div>
        </div>
        <div className="visual" role="img" aria-label={t('visualDescription')}>
          <div className="visual-top"><span>01 / {t('visualLabel')}</span><span className="orange">{t('planned')}</span></div>
          <div className="chess-art" aria-hidden="true"><div className="board-grid" /><span className="ghost-piece">♚</span><span className="main-piece">♞</span><span className="board-coordinate">e4</span></div>
          <div className="visual-bottom"><span>{t('visualCaption')}</span><span aria-hidden="true">↗</span></div>
        </div>
      </section>
      <section id="features" className="features" aria-labelledby="features-heading">
        <div className="section-heading"><div><span className="eyebrow">{t('featuresEyebrow')}</span><h2 id="features-heading">{t('featuresHeading')}</h2></div><p>{t('featuresNote')}</p></div>
        <div className="feature-grid">{features.map((feature, index) => <article className="feature" key={feature.title}><FeatureArtwork index={index} /><span className="feature-number" aria-hidden="true">0{index + 1}</span><div className="feature-body"><h3>{t(feature.title)}</h3><p>{t(feature.description)}</p><span className="feature-status">{t('planned')}</span></div></article>)}</div>
      </section>
      <section id="availability" className="availability" aria-labelledby="availability-heading"><div><span className="eyebrow">{t('availabilityLink')}</span><h2 id="availability-heading">{t('statusHeading')}</h2><p>{t('statusDescription')}</p></div><div className="availability-list"><div><span>{t('homepageLabel')}</span><span className="available">{t('available')}</span></div><div><span>{t('accountLabel')}</span><span className="available">{t('available')}</span></div><div><span>{t('demoLabel')}</span><span>{t('unavailable')}</span></div></div></section>
    </main>} />
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/register" element={<AuthPage key="register" mode="register" />} />
      <Route path="/app/*" element={<ProtectedPage><AccountPage /></ProtectedPage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <footer className="footer wrap"><span className="footer-brand">♞ Chess Analyzer</span><p>{t('footerNote')}</p><span>{t('completedOnly')}</span></footer>
    {notice && <AvailabilityNotice message={notice} onClose={() => setNotice(null)} />}
  </>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><PreferencesProvider><AuthProvider><App /></AuthProvider></PreferencesProvider></BrowserRouter></StrictMode>);
