import { GraphQLClient } from "graphql-request";

const client = new GraphQLClient("http://localhost:3000/api/graphql");

// Buscar conteúdo por linguagem e tenant
export const getContentByLang = async (lang, tenantId = null) => {
  const whereCondition = {
    language: { equals: lang },
    status: { equals: "published" }
  };
  
  if (tenantId) {
    whereCondition.tenantId = { equals: tenantId };
  }

  const query = `
    query GetLocalizedContent(\$where: ContentWhereInput!, \$orderBy: [ContentOrderByInput!]!) {
      contents(where: \$where, orderBy: \$orderBy) {
        id
        title
        slug
        excerpt
        body
        featured_image_url
        meta_title
        meta_description
        status
        language
        content_type
        is_featured
        published_at
        category {
          id
          name
          slug
        }
        author {
          id
          first_name
          last_name
        }
      }
    }
  `;
  return client.request(query, { 
    where: whereCondition, 
    orderBy: [{ published_at: "desc" }] 
  });
};

// Buscar configurações públicas do site
export const getSiteSettings = async (tenantId = null) => {
  const whereCondition = {
    is_public: { equals: true }
  };
  
  if (tenantId) {
    whereCondition.tenantId = { equals: tenantId };
  }

  const query = `
    query GetSiteSettings(\$where: SiteSettingWhereInput!) {
      siteSettings(where: \$where) {
        id
        setting_key
        setting_value
        setting_type
        description
      }
    }
  `;
  return client.request(query, { where: whereCondition });
};

// Buscar menus de navegação ativos
export const getNavigationMenus = async (location = null, tenantId = null) => {
  const whereCondition = {
    is_active: { equals: true }
  };
  
  if (location) {
    whereCondition.location = { equals: location };
  }
  
  if (tenantId) {
    whereCondition.tenantId = { equals: tenantId };
  }

  const query = `
    query GetNavigationMenus(\$where: NavigationMenuWhereInput!) {
      navigationMenus(where: \$where) {
        id
        name
        slug
        location
        menu_items(where: { is_active: { equals: true } }, orderBy: [{ sort_order: "asc" }]) {
          id
          title
          url
          target
          css_class
          sort_order
          content {
            id
            title
            slug
          }
          children(where: { is_active: { equals: true } }, orderBy: [{ sort_order: "asc" }]) {
            id
            title
            url
            target
            sort_order
          }
        }
      }
    }
  `;
  return client.request(query, { where: whereCondition });
};

// Buscar seções ativas com blocos
export const getSections = async (tenantId = null) => {
  const whereCondition = {
    is_active: { equals: true }
  };
  
  if (tenantId) {
    whereCondition.tenantId = { equals: tenantId };
  }

  const query = `
    query GetSections(\$where: SectionWhereInput!, \$orderBy: [SectionOrderByInput!]!) {
      sections(where: \$where, orderBy: \$orderBy) {
        id
        key
        title
        description
        sort_order
        blocks(where: { visible: { equals: true } }, orderBy: [{ order: "asc" }]) {
          id
          type
          title
          order
          data
          carousel {
            id
            name
            autoplay
            interval_ms
            show_arrows
            show_dots
            aspect_ratio
            images(where: { is_active: { equals: true } }, orderBy: [{ order: "asc" }]) {
              id
              url
              alt
              caption
              link_url
              order
              media {
                id
                file_url
                alt_text
                width
                height
              }
            }
          }
          rich_text {
            id
            name
            content
            text_align
          }
          image_banner {
            id
            name
            url
            alt
            link_url
            overlay_text
            overlay_position
            media {
              id
              file_url
              alt_text
              width
              height
            }
          }
          video_embed {
            id
            name
            provider
            video_id
            video_url
            title
            description
            thumbnail_url
            autoplay
            controls
            mute
            loop
            aspect_ratio
          }
          custom_block {
            id
            name
            component_name
            data
            css_classes
            inline_styles
          }
        }
      }
    }
  `;
  return client.request(query, { 
    where: whereCondition, 
    orderBy: [{ sort_order: "asc" }] 
  });
};

// Buscar escola por domínio
export const getSchoolByLng = async (language) => {
  const query = `
    query GetSchoolByLng(\$language: String!) {
      school(where: { language: \$language }) {
        id
        name
        country
        country_name
        timezone
        language
        currency
        domain
        slug
        status
        settings
      }
    }
  `;
  return client.request(query, { domain });
};

// Buscar conteúdo específico por slug
export const getContentBySlug = async (slug, tenantId = null) => {
  const whereCondition = {
    slug: { equals: slug },
    status: { equals: "published" }
  };
  
  if (tenantId) {
    whereCondition.tenantId = { equals: tenantId };
  }

  const query = `
    query GetContentBySlug(\$where: ContentWhereInput!) {
      contents(where: \$where, take: 1) {
        id
        title
        slug
        excerpt
        body
        featured_image_url
        meta_title
        meta_description
        status
        language
        content_type
        is_featured
        published_at
        seo_settings
        custom_fields
        category {
          id
          name
          slug
          description
        }
        author {
          id
          first_name
          last_name
          avatar_url
        }
      }
    }
  `;
  return client.request(query, { where: whereCondition });
};

// Buscar categorias de conteúdo ativas
export const getContentCategories = async (tenantId = null) => {
  const whereCondition = {
    is_active: { equals: true }
  };
  
  if (tenantId) {
    whereCondition.tenantId = { equals: tenantId };
  }

  const query = `
    query GetContentCategories(\$where: ContentCategoryWhereInput!, \$orderBy: [ContentCategoryOrderByInput!]!) {
      contentCategories(where: \$where, orderBy: \$orderBy) {
        id
        name
        slug
        description
        sort_order
        parent {
          id
          name
          slug
        }
        children(where: { is_active: { equals: true } }, orderBy: [{ sort_order: "asc" }]) {
          id
          name
          slug
          description
        }
      }
    }
  `;
  return client.request(query, { 
    where: whereCondition, 
    orderBy: [{ sort_order: "asc" }] 
  });
};

// Buscar arquivos de mídia
export const getMediaFiles = async (tenantId = null, take = 20) => {
  const whereCondition = {
    is_active: { equals: true }
  };
  
  if (tenantId) {
    whereCondition.tenantId = { equals: tenantId };
  }

  const query = `
    query GetMediaFiles(\$where: MediaFileWhereInput!, \$orderBy: [MediaFileOrderByInput!]!, \$take: Int) {
      mediaFiles(where: \$where, orderBy: \$orderBy, take: \$take) {
        id
        filename
        original_filename
        file_url
        mime_type
        file_size
        width
        height
        alt_text
        caption
      }
    }
  `;
  return client.request(query, { 
    where: whereCondition, 
    orderBy: [{ created_at: "desc" }], 
    take 
  });
};