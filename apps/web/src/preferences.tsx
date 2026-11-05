import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createI18n, detectLanguage, isLanguage, type Language } from './i18n';

type Theme = 'dark' | 'light';
type ThemeOrigin = { x: number; y: number };
const storageKeys = { language: 'chess-analyzer.language', theme: 'chess-analyzer.theme' };

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences remain available for this visit when storage is blocked.
  }
}

type Preferences = ReturnType<typeof createI18n> & {
  language: Language;
  theme: Theme;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme, origin?: ThemeOrigin) => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = readPreference(storageKeys.language);
    return isLanguage(saved) ? saved : detectLanguage(navigator.languages.length ? navigator.languages : [navigator.language]);
  });
  const [theme, updateTheme] = useState<Theme>(() =>
    readPreference(storageKeys.theme) === 'light' ? 'light' : 'dark');
  const themeTransitionRunning = useRef(false);

  function setTheme(nextTheme: Theme, origin?: ThemeOrigin) {
    if (themeTransitionRunning.current || nextTheme === theme) return;
    if (!origin || typeof document.startViewTransition !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateTheme(nextTheme);
      return;
    }

    const root = document.documentElement;
    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    root.style.setProperty('--theme-origin-x', `${origin.x}px`);
    root.style.setProperty('--theme-origin-y', `${origin.y}px`);
    root.style.setProperty('--theme-radius', `${Math.ceil(radius)}px`);
    root.dataset.themeTransition = 'true';
    themeTransitionRunning.current = true;

    function cleanup() {
      delete root.dataset.themeTransition;
      for (const property of ['--theme-origin-x', '--theme-origin-y', '--theme-radius']) root.style.removeProperty(property);
      themeTransitionRunning.current = false;
    }

    try {
      const transition = document.startViewTransition(() => {
        // Commit React state and layout effects before the browser captures the new theme.
        flushSync(() => updateTheme(nextTheme));
      });
      void transition.ready.catch(() => {});
      void transition.finished.catch(() => {}).finally(cleanup);
    } catch {
      cleanup();
      updateTheme(nextTheme);
    }
  }

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    savePreference(storageKeys.language, language);
  }, [language]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    savePreference(storageKeys.theme, theme);
  }, [theme]);

  const i18n = useMemo(() => createI18n(language), [language]);

  return (
    <PreferencesContext.Provider value={{ language, theme, setLanguage, setTheme, ...i18n }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error('usePreferences must be used inside PreferencesProvider');
  return preferences;
}
