import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importar traduções
import ptBR from '../locales/pt-BR.json';
import enUS from '../locales/en-US.json';
import esES from '../locales/es-ES.json';
import jaJP from '../locales/ja-JP.json';
import thTH from '../locales/th-TH.json';

const resources = {
  'pt-BR': { translation: ptBR },
  'en-US': { translation: enUS },
  'es-ES': { translation: esES },
  'ja-JP': { translation: jaJP },
  'th-TH': { translation: thTH },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt-BR',
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
    },
  });

export default i18n;