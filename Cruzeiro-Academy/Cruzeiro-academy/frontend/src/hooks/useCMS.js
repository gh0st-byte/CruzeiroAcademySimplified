import { useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';
import { 
  GET_HOMEPAGE, 
  GET_MENU, 
  GET_SITE_SETTINGS, 
  GET_GOOGLE_FORMS,
  GET_CONTENT_BY_SLUG 
} from '../lib/queries';

export const useCMS = (type = 'homepage', options = {}) => {
  const { lang } = useParams();
  const language = lang || 'pt-BR';

  // Seleciona a query baseada no tipo
  const queries = {
    homepage: GET_HOMEPAGE,
    menu: GET_MENU,
    settings: GET_SITE_SETTINGS,
    googleForms: GET_GOOGLE_FORMS,
    content: GET_CONTENT_BY_SLUG
  };

  const query = queries[type];
  
  // Variáveis diferentes para cada tipo
  let variables = { language };
  
  if (type === 'menu') {
    variables.location = options.location || 'header';
  }
  
  if (type === 'content') {
    variables.slug = options.slug;
  }

  const { data, loading, error, refetch } = useQuery(query, {
    variables,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
    ...options
  });

  // Processa os dados baseado no tipo
  const processData = () => {
    if (!data) return null;

    switch (type) {
      case 'homepage':
        // Retorna as sections com blocks
        return {
          sections: data.sections || [],
          // Para compatibilidade, também cria um array de blocks
          blocks: data.sections?.flatMap(section => 
            section.blocks?.map(block => ({
              ...block,
              sectionId: section.id,
              sectionName: section.name
            })) || []
          ) || []
        };
        
      case 'menu':
        return data.menus?.[0] || null;
        
      case 'settings':
        // Converte array de settings em objeto
        const settingsArray = data.settings || [];
        const settingsObject = {};
        settingsArray.forEach(setting => {
          settingsObject[setting.key] = setting.value;
        });
        return settingsObject;
        
      case 'googleForms':
        return data.googleForms || [];
        
      case 'content':
        return data.contents?.[0] || null;
        
      default:
        return data;
    }
  };

  return {
    data: processData(),
    loading,
    error,
    refetch
  };
};