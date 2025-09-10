import { useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';
import { 
  GET_HOMEPAGE, 
  GET_PAGE_BY_SLUG,
  GET_MENU, 
  GET_SITE_SETTINGS, 
  GET_GOOGLE_FORMS,
  GET_MEDIA
} from '../lib/queries';

export const useCMS = (type = 'homepage', options = {}) => {
  const { lang } = useParams();
  const language = lang || 'pt-BR';

  // Seleciona a query baseada no tipo
  const queries = {
    homepage: GET_HOMEPAGE,
    page: GET_PAGE_BY_SLUG,
    menu: GET_MENU,
    settings: GET_SITE_SETTINGS,
    googleForms: GET_GOOGLE_FORMS,
    media: GET_MEDIA
  };

  const query = queries[type];
  
  // Variáveis diferentes para cada tipo
  let variables = { language };
  
  if (type === 'menu') {
    variables.location = options.location || 'header';
  }
  
  if (type === 'page') {
    variables.slug = options.slug;
  }

  if (type === 'media') {
    if (options.category) variables.category = options.category;
    if (options.mediaType) variables.type = options.mediaType;
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
        // Prioriza página homepage, senão usa seções diretas
        const homePage = data.pages?.[0];
        if (homePage) {
          return {
            ...homePage,
            sections: homePage.sections || [],
            blocks: homePage.sections?.flatMap(section => 
              section.blocks?.map(block => ({
                ...block,
                sectionId: section.id,
                sectionName: section.name
              })) || []
            ) || []
          };
        }
        
        // Fallback para seções diretas
        return {
          sections: data.sections || [],
          blocks: data.sections?.flatMap(section => 
            section.blocks?.map(block => ({
              ...block,
              sectionId: section.id,
              sectionName: section.name
            })) || []
          ) || []
        };
        
      case 'page':
        return data.pages?.[0] || null;
        
      case 'menu':
        return data.menus?.[0] || null;
        
      case 'settings':
        // Converte array de settings em objeto organizado
        const settingsArray = data.settings || [];
        const settingsObject = {
          global: {},
          byCategory: {}
        };
        
        settingsArray.forEach(setting => {
          // Adiciona ao objeto global
          settingsObject.global[setting.key] = setting.value || setting.defaultValue;
          
          // Organiza por categoria
          if (!settingsObject.byCategory[setting.category]) {
            settingsObject.byCategory[setting.category] = {};
          }
          settingsObject.byCategory[setting.category][setting.key] = {
            value: setting.value || setting.defaultValue,
            name: setting.name,
            type: setting.type,
            description: setting.description
          };
        });
        
        return settingsObject;
        
      case 'googleForms':
        return data.googleForms || [];
        
      case 'media':
        return data.mediaFiles || [];
        
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