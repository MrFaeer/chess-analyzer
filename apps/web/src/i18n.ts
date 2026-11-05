import { en, type Messages } from './locales/en';
import { ru } from './locales/ru';
import { lv } from './locales/lv';

export const languages = ['en', 'ru', 'lv'] as const;
export type Language = typeof languages[number];
export type MessageKey = keyof Messages;

const dictionaries: Record<Language, Messages> = { en, ru, lv };
const locales: Record<Language, string> = { en: 'en-GB', ru: 'ru-RU', lv: 'lv-LV' };

export function isLanguage(value: unknown): value is Language {
  return languages.some((language) => language === value);
}

export function detectLanguage(browserLanguages: readonly string[]): Language {
  for (const value of browserLanguages) {
    const language = value.toLowerCase().split('-')[0];
    if (isLanguage(language)) return language;
  }
  return 'en';
}

export function createI18n(language: Language) {
  const locale = locales[language];
  return {
    t: (key: MessageKey) => dictionaries[language][key],
    formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, options).format(value),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    plural: (value: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }) =>
      forms[new Intl.PluralRules(locale).select(value)] ?? forms.other,
  };
}
