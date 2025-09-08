import i18n, { init } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n.use(initReactI18next).init({
  lng: navigator.language.split('-')[0] || 'pt', // detecta o idioma do navegador
  fallbackLng: 'en', // idioma padrão
  interpolation: { escapeValue: false }, // react já faz a sanitização
  resources: {
    en: {translation: { welcome: 'welcome'}},
    pt: {translation: { welcome: 'bem-vindo'}},
    es: {translation: { welcome: 'bienvenido'}},
    jp: {translation: { welcome: 'ようこそ'}}
  }
});
export default i18n;