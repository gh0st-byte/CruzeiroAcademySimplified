import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCMS } from '../hooks/useCMS';
import BlockRenderer from '../components/blocks/BlockRenderer';

const HomePage = () => {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  
  // Busca dados da homepage
  const { data: pageData, loading, error } = useCMS('homepage');

  console.log('Homepage data:', pageData); // Debug

  // Sincroniza idioma
  React.useEffect(() => {
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Carregando homepage...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Erro na Homepage</h1>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <details className="text-left">
            <summary className="cursor-pointer">Ver detalhes do erro</summary>
            <pre className="text-xs mt-2 p-4 bg-gray-100 rounded overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  if (!pageData || (!pageData.sections?.length && !pageData.blocks?.length)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-gray-600 mb-4">Homepage Vazia</h1>
          <p className="text-gray-500 mb-2">Nenhuma seção encontrada para este idioma.</p>
          <p className="text-sm text-gray-400">Idioma: {lang || 'pt-BR'}</p>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              💡 Vá para o <a href="http://localhost:3000/admin" target="_blank" className="underline">Admin Keystone</a> e crie algumas seções e blocos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage">
      {/* Renderiza por sections */}
      {pageData.sections?.map((section) => (
        <section 
          key={section.id}
          id={section.identifier || `section-\${section.id}`}
          className="section py-8 md:py-12"
        >
          <div className="container mx-auto px-4">
            <BlockRenderer 
              blocks={section.blocks || []} 
              language={lang || 'pt-BR'}
              sectionData={section}
            />
          </div>
        </section>
      ))}
      
      {/* OU renderiza todos os blocks juntos (fallback) */}
      {!pageData.sections?.length && pageData.blocks?.length && (
        <div className="container mx-auto px-4 py-8">
          <BlockRenderer 
            blocks={pageData.blocks} 
            language={lang || 'pt-BR'}
          />
        </div>
      )}
    </div>
  );
};

export default HomePage;
