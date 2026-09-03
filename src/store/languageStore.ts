import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Language, translations, TranslationKey } from '@/i18n/translations';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  loadLanguage: () => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LANGUAGE_STORAGE_KEY = '@scanfinance_language';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

function getNestedTranslation(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: 'id',

  toggleLanguage: () => {
    const nextLang: Language = get().language === 'id' ? 'en' : 'id';
    get().setLanguage(nextLang);
  },

  setLanguage: (lang: Language) => {
    set({ language: lang });
    if (!isSSR) {
      AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang).catch(() => {});
    }
  },

  loadLanguage: async () => {
    if (isSSR) return;
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'id' || saved === 'en') {
        set({ language: saved });
      }
    } catch {
      // Ignore storage errors on load
    }
  },

  t: (key: TranslationKey, params?: Record<string, string | number>): string => {
    const currentLang = get().language;
    let template = getNestedTranslation(translations[currentLang], key);

    // Fallback to Indonesian if missing in English or vice-versa
    if (template === undefined) {
      template = getNestedTranslation(translations.id, key);
    }

    if (template === undefined) {
      return key;
    }

    if (!params) {
      return template;
    }

    // Replace {key} parameters
    return Object.entries(params).reduce((str, [paramKey, paramVal]) => {
      return str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
    }, template);
  },
}));
