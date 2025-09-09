import { gql } from '@apollo/client';

export const GET_HOMEPAGE_SECTIONS = gql`
  query GetHomepageSections(\$language: String!) {
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
      blocks(
        where: { isVisible: { equals: true } }
        orderBy: { sortOrder: asc }
      ) {
        id
        title
        type
        settings
      }
    }
  }
`;

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
        isHighlighted
        children(orderBy: { order: asc }) {
          id
          label
          url
          type
          target
        }
      }
    }
  }
`;

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
      googleFormUrl
      embedUrl
      title
      description
      buttonText
      displayType
    }
  }
`;