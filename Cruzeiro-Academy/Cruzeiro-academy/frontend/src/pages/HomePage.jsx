import { useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GET_HOMEPAGE_SECTIONS } from '@/lib/queries';
import { BlockRenderer } from '@/components/blocks';
import { Loading } from '@/components/ui/Loading';

export function HomePage() {
  const { lang } = useParams();
  const { t } = useTranslation();
  
  const { data, loading, error } = useQuery(GET_HOMEPAGE_SECTIONS, {
    variables: { language: lang },
  });

  if (loading) return <Loading />;
  if (error) return <div>Error: {error.message}</div>;

  const sections = data?.sections || [];

  return (
    <div className="min-h-screen">
      {sections.map((section) => (
        <section 
          key={section.id} 
          id={section.identifier}
          className="py-8 md:py-12"
        >
          <div className="container mx-auto px-4">
            {section.blocks.map((block) => (
              <div key={block.id} className="mb-8">
                <BlockRenderer block={block} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}