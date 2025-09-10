import i18n from 'i18next'; // ← Remove o { init }
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector) // ← Adicione esta linha
  .use(initReactI18next)
  .init({
    lng: navigator.language.split('-')[0] || 'pt',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    resources: {
      en: { translation: { welcome: 'welcome' } },
      pt: { translation: { welcome: 'bem-vindo' } },
      es: { translation: { welcome: 'bienvenido' } },
      jp: { translation: { welcome: 'ようこそ' } }
    }
  });

export default i18n;