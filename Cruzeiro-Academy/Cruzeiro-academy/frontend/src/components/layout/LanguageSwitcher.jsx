import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'pt-BR', name: 'PT', flag: '🇧🇷' },
  { code: 'en-US', name: 'EN', flag: '🇺🇸' },
  { code: 'es-ES', name: 'ES', flag: '🇪🇸' },
  { code: 'ja-JP', name: 'JP', flag: '🇯🇵' },
  { code: 'th-TH', name: 'TH', flag: '🇹🇭' },
];

export function LanguageSwitcher() {
  const { lang } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  
  const currentLanguage = languages.find(l => l.code === lang);

  const switchLanguage = (newLang) => {
    const newPath = location.pathname.replace(`/\${lang}`, `/\${newLang}`);
    i18n.changeLanguage(newLang);
    navigate(newPath);
  };

  return (
    <div className="relative group">
      <button className="flex items-center space-x-2 px-3 py-2 rounded-md border hover:bg-gray-50">
        <span>{currentLanguage?.flag}</span>
        <span>{currentLanguage?.name}</span>
        <span>↓</span>
      </button>

      <div className="absolute top-full right-0 bg-white shadow-lg rounded-md py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        {languages.map((language) => (
          <button
            key={language.code}
            onClick={() => switchLanguage(language.code)}
            className={`block w-full text-left px-4 py-2 hover:bg-gray-100 \${
              lang === language.code ? 'bg-blue-50 text-blue-600' : ''
            }`}
          >
            <span className="mr-2">{language.flag}</span>
            {language.name}
          </button>
        ))}
      </div>
    </div>
  );
}
