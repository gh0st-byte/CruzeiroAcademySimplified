import { Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAnalytics } from '@/hooks/useAnalytics';

export function Layout() {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  
  // Track analytics
  useAnalytics();

  // Update i18n language when route changes
  useEffect(() => {
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}