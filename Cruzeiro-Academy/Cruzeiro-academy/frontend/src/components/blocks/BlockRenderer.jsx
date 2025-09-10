import React from 'react';

// Placeholder components (vamos criar depois)
const RichTextBlock = ({ id, title, type, settings }) => (
  <div className="rich-text-block p-6 bg-white rounded-lg shadow-sm mb-6">
    <h3 className="text-xl font-bold mb-4">{title || 'Rich Text Block'}</h3>
    <p className="text-gray-600">Tipo: {type}</p>
    <div className="text-sm text-gray-400 mt-2">ID: {id}</div>
  </div>
);

const CarouselBlock = ({ id, title, type, settings }) => (
  <div className="carousel-block p-6 bg-blue-50 rounded-lg shadow-sm mb-6">
    <h3 className="text-xl font-bold mb-4">{title || 'Carousel Block'}</h3>
    <p className="text-gray-600">Tipo: {type}</p>
    <div className="text-sm text-gray-400 mt-2">ID: {id}</div>
  </div>
);

const ImageBannerBlock = ({ id, title, type, settings }) => (
  <div className="image-banner-block p-6 bg-green-50 rounded-lg shadow-sm mb-6">
    <h3 className="text-xl font-bold mb-4">{title || 'Image Banner Block'}</h3>
    <p className="text-gray-600">Tipo: {type}</p>
    <div className="text-sm text-gray-400 mt-2">ID: {id}</div>
  </div>
);

const VideoBlock = ({ id, title, type, settings }) => (
  <div className="video-block p-6 bg-purple-50 rounded-lg shadow-sm mb-6">
    <h3 className="text-xl font-bold mb-4">{title || 'Video Block'}</h3>
    <p className="text-gray-600">Tipo: {type}</p>
    <div className="text-sm text-gray-400 mt-2">ID: {id}</div>
  </div>
);

const GoogleFormBlock = ({ id, title, type, settings }) => (
  <div className="google-form-block p-6 bg-yellow-50 rounded-lg shadow-sm mb-6">
    <h3 className="text-xl font-bold mb-4">{title || 'Google Form Block'}</h3>
    <p className="text-gray-600">Tipo: {type}</p>
    <div className="text-sm text-gray-400 mt-2">ID: {id}</div>
  </div>
);

// Mapa dos blocos
const BLOCK_COMPONENTS = {
  richText: RichTextBlock,
  richTextBlock: RichTextBlock,
  text: RichTextBlock,
  
  carousel: CarouselBlock,
  carouselBlock: CarouselBlock,
  
  imageBanner: ImageBannerBlock,
  imageBannerBlock: ImageBannerBlock,
  hero: ImageBannerBlock,
  
  video: VideoBlock,
  videoBlock: VideoBlock,
  
  googleForm: GoogleFormBlock,
  googleFormBlock: GoogleFormBlock,
};

const BlockRenderer = ({ blocks, language, sectionData }) => {
  console.log('BlockRenderer received:', blocks); // Debug

  if (!blocks || !Array.isArray(blocks)) {
    return (
      <div className="p-4 bg-gray-100 border border-gray-300 rounded">
        <p className="text-gray-600">⚠️ Nenhum bloco para renderizar</p>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="p-4 bg-gray-100 border border-gray-300 rounded">
        <p className="text-gray-600">📝 Seção sem blocos</p>
      </div>
    );
  }

  return (
    <div className="blocks-container">
      {blocks.map((block, index) => {
        const blockType = block.type || block.__typename || block.blockType;
        const BlockComponent = BLOCK_COMPONENTS[blockType];

        if (!BlockComponent) {
          return (
            <div key={block.id || index} className="p-4 bg-red-50 border border-red-200 rounded mb-4">
              <h3 className="font-bold text-red-800">⚠️ Bloco não implementado</h3>
              <p className="text-red-600">Tipo: <code>{blockType}</code></p>
              <p className="text-red-600">Título: {block.title}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm">Ver dados</summary>
                <pre className="text-xs mt-2 p-2 bg-red-100 rounded overflow-auto">
                  {JSON.stringify(block, null, 2)}
                </pre>
              </details>
            </div>
          );
        }

        return (
          <BlockComponent
            key={block.id || `block-\${index}`}
            {...block}
            language={language}
            blockIndex={index}
            sectionData={sectionData}
          />
        );
      })}
    </div>
  );
};

export default BlockRenderer;