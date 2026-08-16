import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { en, TranslationKey } from './locales/en';
import { id } from './locales/id';

export type { TranslationKey };
export type Language = 'en' | 'id';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = 'infinidrive_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'id' || saved === 'en') {
        return saved;
      }
    } catch (e) {
      // Ignore localStorage read errors
    }
    return 'en'; // Default is English
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  const dictionary = useMemo(() => {
    return lang === 'id' ? id : en;
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let str = dictionary[key] || en[key] || String(key);
      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          str = str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }
      return str;
    },
    [dictionary]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
