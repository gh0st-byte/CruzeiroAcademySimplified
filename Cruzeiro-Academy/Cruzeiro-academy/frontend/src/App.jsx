import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './lib/apollo';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { ContentPage } from './pages/ContentPage';
import { NotFound } from './pages/NotFound';
import { useTranslation } from 'react-i18next';
import './lib/i18n';
import './styles/index.css';

const SUPPORTED_LANGUAGES = ['pt-BR', 'en-US', 'es-ES', 'ja-JP', 'th-TH'];

function App() {
  const { i18n } = useTranslation();

  return (
    <ApolloProvider client={apolloClient}>
      <BrowserRouter>
        <Routes>
          {/* Redirect root to default language */}
          <Route path="/" element={<Navigate to="/pt-BR" replace />} />
          
          {/* Language-based routes */}
          {SUPPORTED_LANGUAGES.map(lang => (
            <Route key={lang} path={`/\${lang}`} element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="content/:slug" element={<ContentPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          ))}
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/pt-BR" replace />} />
        </Routes>
      </BrowserRouter>
    </ApolloProvider>
  );
}

export default App;

