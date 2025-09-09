import { list } from '@keystone-6/core';
import { text, password, relationship, timestamp, checkbox, select, json, integer, float } from '@keystone-6/core/fields';

// =================================================================
// ACCESS CONTROL FUNCTIONS - Simplified
// =================================================================
function isAdmin({ session }) {
  return !!session?.data && ['admin', 'super_admin'].includes(session.data.role);
}

function isEditor({ session }) {
  return !!session?.data && ['admin', 'super_admin', 'editor'].includes(session.data.role);
}

function isAuthenticated({ session }) {
  return !!session?.data;
}

// Constant for supported languages
const SUPPORTED_LANGUAGES = [
  { label: 'Português (Brasil)', value: 'pt-BR' },
  { label: 'Inglês (EUA)', value: 'en-US' },
  { label: 'Espanhol (Colombia e Peru)', value: 'es-ES' },
  { label: 'Japonês (Japão)', value: 'ja-JP' },
  { label: 'Tailandês (Tailândia)', value: 'th-TH' },
];

export const lists = {
  // =================================================================
  // USERS & AUTHENTICATION
  // =================================================================
  User: list({
    fields: {
      email: text({ 
        isIndexed: 'unique', 
        validation: { isRequired: true },
        ui: { itemView: { fieldMode: 'read' } }
      }),
      password: password({ validation: { isRequired: true } }),
      name: text({ validation: { isRequired: true } }),
      role: select({
        options: [
          { label: 'Super Admin', value: 'super_admin' },
          { label: 'Admin', value: 'admin' },
          { label: 'Editor', value: 'editor' },
        ],
        defaultValue: 'editor',
        ui: { 
          displayMode: 'segmented-control',
          itemView: { fieldMode: ({ session }) => isAdmin({ session }) ? 'edit' : 'read' }
        }
      }),
      isActive: checkbox({ 
        defaultValue: true,
        ui: { itemView: { fieldMode: ({ session }) => isAdmin({ session }) ? 'edit' : 'read' } }
      }),
      lastLogin: timestamp({ ui: { itemView: { fieldMode: 'read' } } }),
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'email', 'role', 'isActive', 'lastLogin'],
      },
    },
    access: {
      operation: {
        query: isAuthenticated,
        create: isAdmin,
        update: ({ session, item }) => {
          if (isAdmin({ session })) return true;
          return session?.data?.id === item.id;
        },
        delete: isAdmin,
      },
    },
  }),

  // =================================================================
  // CONTENT MANAGEMENT
  // =================================================================
  Content: list({
    fields: {
      title: text({ validation: { isRequired: true } }),
      slug: text({ 
        isIndexed: 'unique', 
        validation: { isRequired: true },
        hooks: {
          resolveInput: ({ resolvedData }) => {
            if (resolvedData.title && !resolvedData.slug) {
              return resolvedData.title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-\$/g, '');
            }
            return resolvedData.slug;
          }
        }
      }),
      excerpt: text({ ui: { displayMode: 'textarea' } }),
      content: text({ 
        ui: { displayMode: 'textarea', description: 'Main page content' },
        validation: { isRequired: true }
      }),
      language: select({
        options: SUPPORTED_LANGUAGES,
        defaultValue: 'pt-BR',
        validation: { isRequired: true },
        ui: { displayMode: 'select' }
      }),
      status: select({
        options: [
          { label: '📝 Draft', value: 'draft' },
          { label: '✅ Published', value: 'published' },
          { label: '📅 Scheduled', value: 'scheduled' },
          { label: '🗄️ Archived', value: 'archived' },
        ],
        defaultValue: 'draft',
        ui: { displayMode: 'segmented-control' }
      }),
      publishedAt: timestamp({
        ui: {
          description: 'Publication date (leave empty to publish immediately)'
        }
      }),
      seoTitle: text({ ui: { description: 'Title for SEO (meta title)' } }),
      seoDescription: text({ 
        ui: { 
          displayMode: 'textarea',
          description: 'Description for SEO (meta description) - max 160 characters'
        }
      }),
      featuredImage: text({ ui: { description: 'Featured image URL' } }),
      author: relationship({ ref: 'User' }),
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
      updatedAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['title', 'language', 'status', 'publishedAt', 'author'],
      },
    },
    access: {
      operation: {
        query: () => true, // Public can view published content
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
    hooks: {
      resolveInput: ({ resolvedData }) => {
        resolvedData.updatedAt = new Date().toISOString();
        return resolvedData;
      }
    }
  }),

  // =================================================================
  // LANDING PAGE SYSTEM
  // =================================================================
  Section: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      identifier: text({ 
        isIndexed: 'unique', 
        validation: { isRequired: true },
        ui: { description: 'Unique identifier (e.g: hero, about, contact)' }
      }),
      language: select({
        options: SUPPORTED_LANGUAGES,
        defaultValue: 'pt-BR',
        validation: { isRequired: true },
        ui: { displayMode: 'segmented-control' }
      }),
      isActive: checkbox({ defaultValue: true }),
      sortOrder: integer({ 
        defaultValue: 0,
        ui: { description: 'Display order on the page' }
      }),
      blocks: relationship({ ref: 'Block.section', many: true }),
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'identifier', 'language', 'sortOrder', 'isActive'],
      },
    },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  Block: list({
    fields: {
      title: text({ validation: { isRequired: true } }),
      type: select({
        options: [
          { label: '🎠 Carousel', value: 'carousel' },
          { label: '📝 Rich Text', value: 'richText' },
          { label: '🖼️ Image Banner', value: 'imageBanner' },
          { label: '🎥 Video', value: 'video' },
          { label: '📋 Google Form', value: 'googleForm' },
          { label: '🧩 Custom Block', value: 'custom' },
        ],
        validation: { isRequired: true },
        ui: { displayMode: 'segmented-control' }
      }),
      section: relationship({ ref: 'Section.blocks', validation: { isRequired: true } }),
      sortOrder: integer({ defaultValue: 0 }),
      isVisible: checkbox({ defaultValue: true }),
      settings: json({ 
        defaultValue: {},
        ui: { 
          description: 'Block-specific settings in JSON format'
        }
      }),
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['title', 'type', 'section', 'sortOrder', 'isVisible'],
      },
    },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // =================================================================
  // GOOGLE FORMS INTEGRATION
  // =================================================================
  GoogleForm: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      language: select({
        options: SUPPORTED_LANGUAGES,
        defaultValue: 'pt-BR',
        validation: { isRequired: true },
        ui: { displayMode: 'segmented-control' }
      }),
      googleFormUrl: text({ 
        validation: { isRequired: true },
        ui: { description: 'Complete Google Form URL' }
      }),
      embedUrl: text({ 
        ui: { description: 'Embed URL (automatically generated)' },
        hooks: {
          resolveInput: ({ resolvedData }) => {
            if (resolvedData.googleFormUrl) {
              // Convert normal URL to embed URL
              const url = resolvedData.googleFormUrl;
              if (url.includes('/viewform')) {
                return url.replace('/viewform', '/viewform?embedded=true');
              }
            }
            return resolvedData.embedUrl;
          }
        }
      }),
      title: text({ ui: { description: 'Form title for display' } }),
      description: text({ 
        ui: { 
          displayMode: 'textarea',
          description: 'Form description'
        }
      }),
      buttonText: text({ 
        defaultValue: 'Fill Form',
        ui: { description: 'Button/link text' }
      }),
      displayType: select({
        options: [
          { label: '🔗 Direct Link', value: 'link' },
          { label: '📱 Embed/iframe', value: 'embed' },
          { label: '🪟 Modal/Popup', value: 'modal' },
        ],
        defaultValue: 'link',
        ui: { displayMode: 'segmented-control' }
      }),
      isActive: checkbox({ defaultValue: true }),
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'language', 'displayType', 'isActive'],
      },
    },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // =================================================================
  // MEDIA & ASSETS
  // =================================================================
  media: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      url: text({ 
        validation: { isRequired: true },
        ui: { description: 'Image/media URL' }
      }),
      alt: text({ ui: { description: 'Alternative text for accessibility' } }),
      caption: text({ ui: { displayMode: 'textarea' } }),
      type: select({
        options: [
          { label: '🖼️ Image', value: 'image' },
          { label: '🎥 Video', value: 'video' },
          { label: '📄 Document', value: 'document' },
        ],
        defaultValue: 'image',
      }),
      isActive: checkbox({ defaultValue: true }),
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'type', 'isActive'],
      },
    },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // =================================================================
  // SITE SETTINGS
  // =================================================================
  Setting: list({
    fields: {
      key: text({ 
        isIndexed: 'unique', 
        validation: { isRequired: true },
        ui: { description: 'Unique setting key' }
      }),
      value: text({ 
        ui: { displayMode: 'textarea' },
        validation: { isRequired: true }
      }),
      language: select({
        options: [
          { label: '🌐 Global (all languages)', value: 'global' },
          ...SUPPORTED_LANGUAGES
        ],
        defaultValue: 'global',
        ui: { displayMode: 'segmented-control' }
      }),
      type: select({
        options: [
          { label: 'Text', value: 'text' },
          { label: 'Number', value: 'number' },
          { label: 'Boolean', value: 'boolean' },
          { label: 'JSON', value: 'json' },
          { label: 'URL', value: 'url' },
        ],
        defaultValue: 'text',
      }),
      description: text({ ui: { displayMode: 'textarea' } }),
      isPublic: checkbox({ 
        defaultValue: false,
        ui: { description: 'If checked, will be accessible via public API' }
      }),
      updatedAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['key', 'language', 'type', 'isPublic'],
      },
    },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
    hooks: {
      resolveInput: ({ resolvedData }) => {
        resolvedData.updatedAt = new Date().toISOString();
        return resolvedData;
      }
    }
  }),

  // =================================================================
  // ANALYTICS & MONITORING (Simplified)
  // =================================================================
  PageView: list({
    fields: {
      page: text({ validation: { isRequired: true } }),
      language: text({ defaultValue: 'pt-BR' }),
      userAgent: text(),
      ipAddress: text(),
      referrer: text(),
      timestamp: timestamp({ 
        defaultValue: { kind: 'now' },
        validation: { isRequired: true }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['page', 'language', 'timestamp'],
      },
      hideCreate: true, // Created automatically via API
    },
    access: {
      operation: {
        query: isAdmin,
        create: () => true, // Public API can create
        update: () => false,
        delete: isAdmin,
      },
    },
  }),



  // =================================================================
// NAVIGATION & MENUS 
// =================================================================
Menu: list({
  fields: {
    name: text({ 
      validation: { isRequired: true },
      ui: { description: 'Display name for this menu' }
    }),
    identifier: text({ 
      isIndexed: 'unique', 
      validation: { isRequired: true },
      ui: { description: 'Unique identifier (e.g., main-menu, footer-menu, mobile-menu)' },
      hooks: {
        resolveInput: ({ resolvedData }) => {
          if (resolvedData.name && !resolvedData.identifier) {
            return resolvedData.name.toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-\$/g, '');
          }
          return resolvedData.identifier;
        }
      }
    }),
    language: select({
      options: SUPPORTED_LANGUAGES,
      defaultValue: 'pt-BR',
      validation: { isRequired: true },
      ui: { 
        displayMode: 'select',
        description: 'Language for this menu'
      }
    }),
    location: select({
      options: [
        { label: ' Header Menu', value: 'header' },
        { label: ' Mobile Menu', value: 'mobile' },
        { label: ' Footer Menu', value: 'footer' },
        { label: ' User Menu', value: 'user' },
        { label: ' Sidebar Menu', value: 'sidebar' },
      ],
      defaultValue: 'header',
      ui: { displayMode: 'select' }
    }),
    description: text({ 
      ui: { 
        displayMode: 'textarea',
        description: 'Optional description for admin reference'
      }
    }),
    isActive: checkbox({ 
      defaultValue: true,
      ui: { description: 'Enable/disable this entire menu' }
    }),
    cssClass: text({ 
      ui: { description: 'Custom CSS class for styling' }
    }),
    maxDepth: integer({ 
      defaultValue: 3,
      ui: { description: 'Maximum nesting level (1 = no submenus)' }
    }),
    items: relationship({ ref: 'MenuItem.menu', many: true }),
    createdAt: timestamp({ 
      defaultValue: { kind: 'now' },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
    }),
    updatedAt: timestamp({ 
      defaultValue: { kind: 'now' },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
    }),
  },
  ui: {
    listView: {
      initialColumns: ['name', 'identifier', 'language', 'location', 'isActive'],
    },
    labelField: 'name',
  },
  hooks: {
    resolveInput: ({ resolvedData }) => {
      resolvedData.updatedAt = new Date().toISOString();
      return resolvedData;
    }
  },
  access: {
    operation: {
      query: () => true,
      create: isEditor,
      update: isEditor,
      delete: isAdmin,
    },
  },
}),

MenuItem: list({
  fields: {
    label: text({ 
      validation: { isRequired: true },
      ui: { description: 'Text displayed in the menu' }
    }),
    url: text({ 
      validation: { isRequired: true },
      ui: { description: 'URL or path (e.g., /about, https://example.com, #section)' }
    }),
    type: select({
      options: [
        { label: ' Internal Page', value: 'internal' },
        { label: ' External Link', value: 'external' },
        { label: ' Email', value: 'email' },
        { label: ' Phone', value: 'phone' },
        { label: ' Anchor/Section', value: 'anchor' },
        { label: ' Action', value: 'action' },
      ],
      defaultValue: 'internal',
      ui: { 
        displayMode: 'select',
        description: 'Type of link'
      }
    }),
    target: select({
      options: [
        { label: ' Same Window', value: '_self' },
        { label: ' New Tab', value: '_blank' },
        { label: ' Modal/Popup', value: '_modal' },
      ],
      defaultValue: '_self',
      ui: { displayMode: 'select' }
    }),
    icon: text({ 
      ui: { 
        description: 'Icon class or emoji (e.g., "fas fa-home", "🏠")'
      }
    }),
    description: text({ 
      ui: { 
        displayMode: 'textarea',
        description: 'Tooltip or subtitle text (optional)'
      }
    }),
    order: integer({ 
      defaultValue: 0,
      ui: { description: 'Sort order (lower numbers appear first)' }
    }),
    isActive: checkbox({ 
      defaultValue: true,
      ui: { description: 'Show/hide this menu item' }
    }),
    isHighlighted: checkbox({ 
      defaultValue: false,
      ui: { description: 'Special styling (e.g., CTA button)' }
    }),
    requiresAuth: checkbox({ 
      defaultValue: false,
      ui: { description: 'Only show to logged-in users' }
    }),
    cssClass: text({ 
      ui: { description: 'Custom CSS class for this item' }
    }),
    
    // Relationships
    menu: relationship({ 
      ref: 'Menu.items', 
      validation: { isRequired: true },
      ui: { description: 'Which menu this item belongs to' }
    }),
    content: relationship({ 
      ref: 'Content',
      ui: { description: 'Link to internal content (optional)' }
    }),
    parentItem: relationship({ 
      ref: 'MenuItem.children',
      ui: { description: 'Parent menu item (for submenus)' }
    }),
    children: relationship({ 
      ref: 'MenuItem.parentItem', 
      many: true,
      ui: { description: 'Child menu items (submenus)' }
    }),
    
    // Metadata
    clickCount: integer({ 
      defaultValue: 0,
      ui: { 
        itemView: { fieldMode: 'read' },
        description: 'Number of times this link was clicked'
      }
    }),
    createdAt: timestamp({ 
      defaultValue: { kind: 'now' },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
    }),
    updatedAt: timestamp({ 
      defaultValue: { kind: 'now' },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
    }),
  },
  ui: {
    listView: {
      initialColumns: ['label', 'url', 'type', 'menu', 'order', 'isActive'],
    },
    labelField: 'label',
  },
  hooks: {
    resolveInput: ({ resolvedData }) => {
      // Auto-generate URL based on content relationship
      if (resolvedData.content && !resolvedData.url) {
        // This would need to be implemented based on your content URL structure
        resolvedData.url = `/content/\${resolvedData.content}`;
      }
      
      // Auto-set type based on URL
      if (resolvedData.url && !resolvedData.type) {
        if (resolvedData.url.startsWith('http')) {
          resolvedData.type = 'external';
        } else if (resolvedData.url.startsWith('mailto:')) {
          resolvedData.type = 'email';
        } else if (resolvedData.url.startsWith('tel:')) {
          resolvedData.type = 'phone';
        } else if (resolvedData.url.startsWith('#')) {
          resolvedData.type = 'anchor';
        } else {
          resolvedData.type = 'internal';
        }
      }
      
      resolvedData.updatedAt = new Date().toISOString();
      return resolvedData;
    }
  },
  access: {
    operation: {
      query: () => true,
      create: isEditor,
      update: isEditor,
      delete: isAdmin,
    },
  },
}),
};