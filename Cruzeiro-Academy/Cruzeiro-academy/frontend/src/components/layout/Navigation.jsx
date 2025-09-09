import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { GET_MENU } from '@/lib/queries';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Navigation() {
  const { lang } = useParams();
  const { t } = useTranslation();

  const { data } = useQuery(GET_MENU, {
    variables: { language: lang, location: 'header' }
  });

  const menu = data?.menus[0];

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to={`/\${lang}`} className="text-2xl font-bold text-blue-600">
            {t('common.siteName', 'Cruzeiro Academy')}
          </Link>

          {/* Menu Items */}
          <div className="hidden md:flex space-x-6">
            {menu?.items.map((item) => (
              <div key={item.id} className="relative group">
                <Link
                  to={item.type === 'internal' ? `/\${lang}\${item.url}` : item.url}
                  target={item.target}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors \${
                    item.isHighlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>

                {/* Submenu */}
                {item.children?.length > 0 && (
                  <div className="absolute top-full left-0 bg-white shadow-lg rounded-md py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    {item.children.map((child) => (
                      <Link
                        key={child.id}
                        to={child.type === 'internal' ? `/\${lang}\${child.url}` : child.url}
                        target={child.target}
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        {child.icon && <span className="mr-2">{child.icon}</span>}
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Language Switcher */}
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  );
}
