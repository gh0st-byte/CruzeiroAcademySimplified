import { gql } from '@apollo/client';

// =================================================================
// HOMEPAGE - Agora usando Pages + Sections
// =================================================================
export const GET_HOMEPAGE = gql`
  query GetHomepage(\$language: String!) {
    # Método 1: Buscar página tipo "homepage" 
    pages(
      where: { 
        type: { equals: "homepage" }
        language: { equals: \$language }
        status: { equals: "published" }
      }
      take: 1
    ) {
      id
      title
      type
      language
      seoTitle
      seoDescription
      seoKeywords
      socialTitle
      socialDescription
      socialImage {
        id
        url
        alt
      }
      sections(
        where: { isActive: { equals: true } }
        orderBy: { sortOrder: asc }
      ) {
        id
        name
        identifier
        title
        subtitle
        backgroundColor
        backgroundImage {
          id
          url
          alt
        }
        cssClass
        padding
        blocks(
          where: { isVisible: { equals: true } }
          orderBy: { sortOrder: asc }
        ) {
          id
          title
          type
          content
          subtitle
          buttonText
          buttonUrl
          layout
          backgroundColor
          textColor
          cssClass
          image {
            id
            url
            alt
            width
            height
          }
          video {
            id
            url
            alt
          }
          gallery {
            id
            url
            alt
            width
            height
          }
          googleForm {
            id
            name
            title
            description
            buttonText
            displayType
            googleFormUrl
            embedUrl
            buttonColor
            buttonSize
          }
          sortOrder
          settings
        }
      }
      featuredImage {
        id
        url
        alt
      }
      author {
        id
        name
      }
    }
    
    # Método 2: Buscar seções diretamente (fallback)
    sections(
      where: { 
        language: { equals: \$language }
        isActive: { equals: true }
        page: null  # Seções não vinculadas a página específica
      }
      orderBy: { sortOrder: asc }
    ) {
      id
      name
      identifier
      title
      subtitle
      backgroundColor
      backgroundImage {
        id
        url
        alt
      }
      cssClass
      padding
      blocks(
        where: { isVisible: { equals: true } }
        orderBy: { sortOrder: asc }
      ) {
        id
        title
        type
        content
        subtitle
        buttonText
        buttonUrl
        layout
        backgroundColor
        textColor
        cssClass
        image {
          id
          url
          alt
          width
          height
        }
        video {
          id
          url
          alt
        }
        gallery {
          id
          url
          alt
          width
          height
        }
        googleForm {
          id
          name
          title
          description
          buttonText
          displayType
          googleFormUrl
          embedUrl
          buttonColor
          buttonSize
        }
        sortOrder
        settings
      }
    }
  }
`;

// =================================================================
// PÁGINA POR SLUG
// =================================================================
export const GET_PAGE_BY_SLUG = gql`
  query GetPageBySlug(\$slug: String!, \$language: String!) {
    pages(
      where: { 
        slug: { equals: \$slug }
        language: { equals: \$language }
        status: { equals: "published" }
      }
      take: 1
    ) {
      id
      title
      type
      excerpt
      language
      status
      publishedAt
      seoTitle
      seoDescription
      seoKeywords
      socialTitle
      socialDescription
      socialImage {
        id
        url
        alt
      }
      sections(
        where: { isActive: { equals: true } }
        orderBy: { sortOrder: asc }
      ) {
        id
        name
        identifier
        title
        subtitle
        backgroundColor
        backgroundImage {
          id
          url
          alt
        }
        blocks(
          where: { isVisible: { equals: true } }
          orderBy: { sortOrder: asc }
        ) {
          id
          title
          type
          content
          subtitle
          buttonText
          buttonUrl
          layout
          image {
            id
            url
            alt
          }
          gallery {
            id
            url
            alt
          }
          googleForm {
            id
            title
            description
            buttonText
            googleFormUrl
            embedUrl
            displayType
          }
          settings
        }
      }
      featuredImage {
        id
        url
        alt
      }
      author {
        id
        name
      }
      viewCount
      createdAt
      updatedAt
    }
  }
`;

// =================================================================
// MENU (já estava correto, pequenos ajustes)
// =================================================================
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
      location
      description
      cssClass
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
        requiresAuth
        cssClass
        page {
          id
          slug
          title
        }
        children(
          where: { isActive: { equals: true } }
          orderBy: { order: asc }
        ) {
          id
          label
          url
          type
          target
          icon
          order
          page {
            id
            slug
            title
          }
        }
      }
    }
  }
`;

// =================================================================
// CONFIGURAÇÕES DO SITE
// =================================================================
export const GET_SITE_SETTINGS = gql`
  query GetSiteSettings(\$language: String!) {
    settings(
      where: { 
        OR: [
          { language: { equals: \$language } }
          { language: { equals: "global" } }
        ]
        isPublic: { equals: true }
      }
    ) {
      id
      key
      name
      value
      defaultValue
      category
      language
      type
      description
    }
  }
`;

// =================================================================
// GOOGLE FORMS
// =================================================================
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
      buttonColor
      buttonSize
      clickCount
      isActive
      createdAt
    }
  }
`;

// =================================================================
// MEDIA
// =================================================================
// MEDIA
export const GET_MEDIA = gql`
  query GetMedia(\$category: String, \$type: String) {
    mediaFiles(
      where: { 
        isActive: { equals: true }
        \${category ? 'category: { equals: \$category }' : ''}
        \${type ? 'type: { equals: \$type }' : ''}
      }
      orderBy: { createdAt: desc }
    ) {
      id
      name
      alt
      caption
      url
      filename
      mimeType
      width
      height
      type
      category
      tags
      isFeatured
      usageCount
      createdAt
    }
  }
`;

// =================================================================
// BUSCA GERAL
// =================================================================
export const SEARCH_CONTENT = gql`
  query SearchContent(\$query: String!, \$language: String!) {
    pages(
      where: {
        AND: [
          { language: { equals: \$language } }
          { status: { equals: "published" } }
          {
            OR: [
              { title: { contains: \$query, mode: insensitive } }
              { excerpt: { contains: \$query, mode: insensitive } }
              { seoDescription: { contains: \$query, mode: insensitive } }
            ]
          }
        ]
      }
      take: 10
    ) {
      id
      title
      slug
      type
      excerpt
      seoDescription
      featuredImage {
        id
        url
        alt
      }
      publishedAt
    }
  }
`;

// =================================================================
// ANALYTICS
// =================================================================
export const CREATE_PAGE_VIEW = gql`
  mutation CreatePageView(\$data: PageViewCreateInput!) {
    createPageView(data: \$data) {
      id
      timestamp
    }
  }
`;

export const GET_PAGE_ANALYTICS = gql`
  query GetPageAnalytics(\$startDate: DateTime!, \$endDate: DateTime!) {
    pageViews(
      where: {
        timestamp: {
          gte: \$startDate
          lte: \$endDate
        }
      }
    ) {
      id
      page
      language
      timestamp
    }
  }
`;