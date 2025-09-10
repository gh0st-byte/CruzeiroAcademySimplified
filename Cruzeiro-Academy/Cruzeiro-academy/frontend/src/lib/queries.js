import { gql } from '@apollo/client';

// HOMEPAGE usando SECTIONS (como você já tinha - estava certo!)
export const GET_HOMEPAGE = gql`
  query GetHomepage(\$language: String!) {
    sections(
      where: { 
        language: { equals: \$language }
        isActive: { equals: true }
      }
      orderBy: { sortOrder: asc }
    ) {
      id
      name
      identifier
      language
      isActive
      sortOrder
      blocks(
        where: { isVisible: { equals: true } }
        orderBy: { sortOrder: asc }
      ) {
        id
        title
        type
        sortOrder
        isVisible
        settings
        createdAt
      }
      createdAt
    }
  }
`;

// MENU (já estava correto)
export const GET_MENU = gql`
  query GetMenu(\$language: String!, \$location: String!) {
    menus(
      where: { 
        language: { equals: \$language }
        location: { equals: \$location }
        isActive: { equals: true }
      }
    ) {
      id
      name
      identifier
      language
      location
      description
      isActive
      items(
        where: { isActive: { equals: true } }
        orderBy: { order: asc }
      ) {
        id
        label
        url
        type
        target
        icon
        description
        order
        isActive
        isHighlighted
        children(
          where: { isActive: { equals: true } }
          orderBy: { order: asc }
        ) {
          id
          label
          url
          type
          target
          order
        }
      }
    }
  }
`;

// SITE SETTINGS (corrigido para usar 'settings')
export const GET_SITE_SETTINGS = gql`
  query GetSiteSettings(\$language: String!) {
    settings(
      where: { 
        language: { equals: \$language }
        isPublic: { equals: true }
      }
    ) {
      id
      key
      value
      language
      type
      description
      isPublic
      updatedAt
    }
  }
`;

// GOOGLE FORMS (já estava correto)
export const GET_GOOGLE_FORMS = gql`
  query GetGoogleForms(\$language: String!) {
    googleForms(
      where: { 
        language: { equals: \$language }
        isActive: { equals: true }
      }
    ) {
      id
      name
      language
      googleFormUrl
      embedUrl
      title
      description
      buttonText
      displayType
      isActive
      createdAt
    }
  }
`;

// CONTENT POR SLUG (para páginas individuais)
export const GET_CONTENT_BY_SLUG = gql`
  query GetContentBySlug(\$slug: String!, \$language: String!) {
    contents(
      where: { 
        slug: { equals: \$slug }
        language: { equals: \$language }
        status: { equals: "published" }
      }
      take: 1
    ) {
      id
      title
      slug
      excerpt
      content
      language
      status
      publishedAt
      seoTitle
      seoDescription
      featuredImage
      author {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;

// MEDIA
export const GET_MEDIA = gql`
  query GetMedia {
    media(
      where: { isActive: { equals: true } }
      orderBy: { createdAt: desc }
    ) {
      id
      name
      url
      alt
      caption
      type
      isActive
      createdAt
    }
  }
`;
