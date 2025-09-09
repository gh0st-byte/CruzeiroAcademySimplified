import { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { apolloClient } from '@/lib/apollo';
import { gql } from '@apollo/client';

const CREATE_PAGE_VIEW = gql`
  mutation CreatePageView(\$data: PageViewCreateInput!) {
    createPageView(data: \$data) {
      id
    }
  }
`;

export function useAnalytics() {
  const { lang } = useParams();
  const location = useLocation();

  useEffect(() => {
    const trackPageView = async () => {
      try {
        await apolloClient.mutate({
          mutation: CREATE_PAGE_VIEW,
          variables: {
            data: {
              page: location.pathname,
              language: lang,
              userAgent: navigator.userAgent,
              referrer: document.referrer,
            },
          },
        });
      } catch (error) {
        console.error('Analytics error:', error);
      }
    };

    trackPageView();
  }, [location.pathname, lang]);

  const trackEvent = async (event, data) => {
    // Implementar tracking de eventos se necessário
    console.log('Event tracked:', event, data);
  };

  return { trackEvent };
}