import { list } from '@keystone-6/core';
import { text, password, relationship, timestamp, checkbox, select, json, integer, float, image, file } from '@keystone-6/core/fields';

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
          displayMode: 'select',
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
  // PAGES SYSTEM (Including Homepage)
  // =================================================================
  Page: list({
    fields: {
      title: text({ validation: { isRequired: true } }),
      slug: text({ 
        isIndexed: 'unique', 
        validation: { isRequired: true },
        ui: { description: 'Use "home" for homepage' },
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
      type: select({
        options: [
          { label: '🏠 Homepage', value: 'homepage' },
          { label: '📄 Regular Page', value: 'page' },
          { label: '📰 Landing Page', value: 'landing' },
          { label: '🔗 External Link', value: 'external' },
        ],
        defaultValue: 'page',
        ui: { displayMode: 'select' }
      }),
      excerpt: text({ ui: { displayMode: 'textarea' } }),
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
        ui: { displayMode: 'select' }
      }),
      publishedAt: timestamp({
        ui: { description: 'Publication date (leave empty to publish immediately)' }
      }),
      
      // SEO Fields
      seoTitle: text({ 
        ui: { description: 'Title for SEO (meta title) - max 60 characters' } 
      }),
      seoDescription: text({ 
        ui: { 
          displayMode: 'textarea',
          description: 'Description for SEO (meta description) - max 160 characters'
        }
      }),
      seoKeywords: text({ 
        ui: { description: 'Keywords separated by commas' }
      }),
      socialTitle: text({ 
        ui: { description: 'Title for social media sharing (Open Graph)' }
      }),
      socialDescription: text({ 
        ui: { 
          displayMode: 'textarea',
          description: 'Description for social media sharing'
        }
      }),
      socialImage: relationship({ 
        ref: 'MediaFile',
        ui: { description: 'Image for social media sharing (1200x630px recommended)' }
      }),
      
      // Content & Structure
      sections: relationship({ ref: 'Section.page', many: true }),
      featuredImage: relationship({ ref: 'MediaFile' }),
      author: relationship({ ref: 'User' }),
      
      // Metadata
      viewCount: integer({ 
        defaultValue: 0,
        ui: { itemView: { fieldMode: 'read' } }
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
        initialColumns: ['title', 'type', 'language', 'status', 'publishedAt', 'author'],
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
  // ENHANCED SECTIONS SYSTEM
  // =================================================================
  Section: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      identifier: text({ 
        isIndexed: 'unique', 
        validation: { isRequired: true },
        ui: { description: 'Unique identifier (e.g: hero, about, contact)' }
      }),
      title: text({ 
        ui: { description: 'Display title (optional)' }
      }),
      subtitle: text({ 
        ui: { description: 'Subtitle or tagline (optional)' }
      }),
      language: select({
        options: SUPPORTED_LANGUAGES,
        defaultValue: 'pt-BR',
        validation: { isRequired: true },
        ui: { displayMode: 'select' }
      }),
      page: relationship({ 
        ref: 'Page.sections',
        ui: { description: 'Which page this section belongs to (optional)' }
      }),
      isActive: checkbox({ defaultValue: true }),
      sortOrder: integer({ 
        defaultValue: 0,
        ui: { description: 'Display order on the page' }
      }),
      
      // Layout & Styling
      backgroundColor: text({ 
        ui: { description: 'Background color (hex, rgb, or CSS class)' }
      }),
      backgroundImage: relationship({ 
        ref: 'MediaFile',
        ui: { description: 'Background image' }
      }),
      cssClass: text({ 
        ui: { description: 'Custom CSS classes' }
      }),
      padding: select({
        options: [
          { label: 'None', value: 'none' },
          { label: 'Small', value: 'small' },
          { label: 'Medium', value: 'medium' },
          { label: 'Large', value: 'large' },
          { label: 'Extra Large', value: 'xl' },
        ],
        defaultValue: 'medium',
      }),
      
      // Content
      blocks: relationship({ ref: 'Block.section', many: true }),
      settings: json({ 
        defaultValue: {},
        ui: { description: 'Section-specific settings' }
      }),
      
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'identifier', 'page', 'language', 'sortOrder', 'isActive'],
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
  // ENHANCED BLOCKS SYSTEM
  // =================================================================
  Block: list({
    fields: {
      title: text({ validation: { isRequired: true } }),
      type: select({
        options: [
          { label: '🎠 Carousel', value: 'carousel' },
          { label: '📝 Rich Text', value: 'richText' },
          { label: '🖼️ Image Banner/Hero', value: 'imageBanner' },
          { label: '🎥 Video', value: 'video' },
          { label: '📋 Google Form', value: 'googleForm' },
          { label: '📷 Image Gallery', value: 'gallery' },
          { label: '📊 Statistics/Numbers', value: 'stats' },
          { label: '👥 Team/Testimonials', value: 'team' },
          { label: '📞 Contact Info', value: 'contact' },
          { label: '🧩 Custom HTML', value: 'custom' },
        ],
        validation: { isRequired: true },
        ui: { displayMode: 'select' }
      }),
      
      // Content Fields
      content: text({ 
        ui: { 
          displayMode: 'textarea',
          description: 'Main content (HTML allowed)'
        }
      }),
      subtitle: text({ 
        ui: { description: 'Subtitle or tagline' }
      }),
      buttonText: text({ 
        ui: { description: 'Call-to-action button text' }
      }),
      buttonUrl: text({ 
        ui: { description: 'Button link URL' }
      }),
      
      // Media
      image: relationship({ 
        ref: 'MediaFile',
        ui: { description: 'Primary image' }
      }),
      video: relationship({ 
        ref: 'MediaFile',
        ui: { description: 'Video file or embed' }
      }),
      gallery: relationship({ 
        ref: 'MediaFile',
        many: true,
        ui: { description: 'Image gallery' }
      }),
      
      // Layout & Style
      layout: select({
        options: [
          { label: 'Full Width', value: 'full' },
          { label: 'Centered', value: 'center' },
          { label: 'Left Aligned', value: 'left' },
          { label: 'Right Aligned', value: 'right' },
          { label: '2 Columns', value: 'columns-2' },
          { label: '3 Columns', value: 'columns-3' },
        ],
        defaultValue: 'center',
      }),
      backgroundColor: text({ 
        ui: { description: 'Block background color' }
      }),
      textColor: text({ 
        ui: { description: 'Text color' }
      }),
      cssClass: text({ 
        ui: { description: 'Custom CSS classes' }
      }),
      
      // Relationships
      section: relationship({ ref: 'Section.blocks' }),
      googleForm: relationship({ 
        ref: 'GoogleForm',
        ui: { description: 'Link to Google Form (for form blocks)' }
      }),
      
      // Metadata
      sortOrder: integer({ defaultValue: 0 }),
      isVisible: checkbox({ defaultValue: true }),
      settings: json({ 
        defaultValue: {},
        ui: { description: 'Block-specific settings in JSON format' }
      }),
      
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['title', 'type', 'section', 'layout', 'sortOrder', 'isVisible'],
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
  // ENHANCED MEDIA SYSTEM
  // =================================================================
  MediaFile: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      alt: text({ 
        validation: { isRequired: true },
        ui: { description: 'Alternative text for accessibility' }
      }),
      caption: text({ ui: { displayMode: 'textarea' } }),
      
      // File Info
      url: text({ 
        validation: { isRequired: true },
        ui: { description: 'Image/media URL or upload path' }
      }),
      filename: text({ 
        ui: { description: 'Original filename' }
      }),
      mimeType: text({ 
        ui: { description: 'File MIME type (e.g., image/jpeg)' }
      }),
      filesize: integer({ 
        ui: { description: 'File size in bytes' }
      }),
      
      // Image Specific
      width: integer({ 
        ui: { description: 'Image width in pixels' }
      }),
      height: integer({ 
        ui: { description: 'Image height in pixels' }
      }),
      
      // Organization
      type: select({
        options: [
          { label: '🖼️ Image', value: 'image' },
          { label: '🎥 Video', value: 'video' },
          { label: '📄 Document', value: 'document' },
          { label: '🎵 Audio', value: 'audio' },
          { label: '📊 Icon/SVG', value: 'icon' },
        ],
        defaultValue: 'image',
      }),
      category: select({
        options: [
          { label: '📷 General Images', value: 'general' },
          { label: '🏠 Hero/Banner', value: 'hero' },
          { label: '👤 Profile/Team', value: 'profile' },
          { label: '📱 Social Media', value: 'social' },
          { label: '🏢 Logo/Branding', value: 'logo' },
          { label: '📊 Icons', value: 'icons' },
          { label: '🎨 Gallery', value: 'gallery' },
        ],
        defaultValue: 'general',
      }),
      tags: text({ 
        ui: { description: 'Tags separated by commas (for searching)' }
      }),
      
      // SEO & Social
      seoTitle: text({ 
        ui: { description: 'SEO title for this media' }
      }),
      
      // Status
      isActive: checkbox({ defaultValue: true }),
      isFeatured: checkbox({ 
        defaultValue: false,
        ui: { description: 'Mark as featured media' }
      }),
      
      // Usage tracking
      usageCount: integer({ 
        defaultValue: 0,
        ui: { itemView: { fieldMode: 'read' } }
      }),
      
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'type', 'category', 'isActive', 'createdAt'],
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
  // ENHANCED GOOGLE FORMS INTEGRATION
  // =================================================================
  GoogleForm: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      language: select({
        options: SUPPORTED_LANGUAGES,
        defaultValue: 'pt-BR',
        validation: { isRequired: true },
        ui: { displayMode: 'select' }
      }),
      
      // Form URLs
      googleFormUrl: text({ 
        validation: { isRequired: true },
        ui: { description: 'Complete Google Form URL' }
      }),
      embedUrl: text({ 
        ui: { description: 'Embed URL (automatically generated)' },
        hooks: {
          resolveInput: ({ resolvedData }) => {
            if (resolvedData.googleFormUrl) {
              const url = resolvedData.googleFormUrl;
              if (url.includes('/viewform')) {
                return url.replace('/viewform', '/viewform?embedded=true');
              }
            }
            return resolvedData.embedUrl;
          }
        }
      }),
      
      // Display Content
      title: text({ ui: { description: 'Form title for display' } }),
      description: text({ 
        ui: { 
          displayMode: 'textarea',
          description: 'Form description'
        }
      }),
      buttonText: text({ 
        defaultValue: 'Preencher Formulário',
        ui: { description: 'Button/link text' }
      }),
      
      // Display Options
      displayType: select({
        options: [
          { label: '🔗 Direct Link', value: 'link' },
          { label: '📱 Embed/iframe', value: 'embed' },
          { label: '🪟 Modal/Popup', value: 'modal' },
          { label: '🎯 Button CTA', value: 'button' },
        ],
        defaultValue: 'button',
        ui: { displayMode: 'select' }
      }),
      
      // Styling
      buttonColor: text({ 
        defaultValue: '#007bff',
        ui: { description: 'Button background color (hex)' }
      }),
      buttonSize: select({
        options: [
          { label: 'Small', value: 'small' },
          { label: 'Medium', value: 'medium' },
          { label: 'Large', value: 'large' },
        ],
        defaultValue: 'medium',
      }),
      
      // Analytics
      clickCount: integer({ 
        defaultValue: 0,
        ui: { itemView: { fieldMode: 'read' } }
      }),
      
      isActive: checkbox({ defaultValue: true }),
      createdAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'language', 'displayType', 'clickCount', 'isActive'],
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
  // ENHANCED SETTINGS SYSTEM
  // =================================================================
  Setting: list({
    fields: {
      key: text({ 
        isIndexed: 'unique', 
        validation: { isRequired: true },
        ui: { description: 'Unique setting key (e.g., site_name, logo_url)' }
      }),
      name: text({ 
        validation: { isRequired: true },
        ui: { description: 'Human-readable name' }
      }),
      value: text({ 
        ui: { displayMode: 'textarea' },
        validation: { isRequired: true }
      }),
      defaultValue: text({ 
        ui: { description: 'Default value if empty' }
      }),
      
      // Organization
      category: select({
        options: [
          { label: '⚙️ General', value: 'general' },
          { label: '🎨 Appearance', value: 'appearance' },
          { label: '📧 Contact', value: 'contact' },
          { label: '📱 Social Media', value: 'social' },
          { label: '🔍 SEO', value: 'seo' },
          { label: '📊 Analytics', value: 'analytics' },
          { label: '🌐 Localization', value: 'localization' },
        ],
        defaultValue: 'general',
      }),
      
      language: select({
        options: [
          { label: '🌐 Global (all languages)', value: 'global' },
          ...SUPPORTED_LANGUAGES
        ],
        defaultValue: 'global',
        ui: { displayMode: 'select' }
      }),
      
      type: select({
        options: [
          { label: 'Text', value: 'text' },
          { label: 'Long Text', value: 'textarea' },
          { label: 'Number', value: 'number' },
          { label: 'Boolean', value: 'boolean' },
          { label: 'JSON', value: 'json' },
          { label: 'URL', value: 'url' },
          { label: 'Email', value: 'email' },
          { label: 'Color', value: 'color' },
        ],
        defaultValue: 'text',
      }),
      
      description: text({ 
        ui: { 
          displayMode: 'textarea',
          description: 'Description of what this setting does'
        }
      }),
      
      // Permissions
      isPublic: checkbox({ 
        defaultValue: false,
        ui: { description: 'If checked, will be accessible via public API' }
      }),
      isRequired: checkbox({ 
        defaultValue: false,
        ui: { description: 'Required setting' }
      }),
      
      // Validation
      validation: json({
        ui: { description: 'Validation rules (JSON format)' }
      }),
      
      updatedAt: timestamp({ 
        defaultValue: { kind: 'now' },
        ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'key', 'category', 'language', 'type', 'isPublic'],
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
  // ANALYTICS & MONITORING
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
      hideCreate: true,
    },
    access: {
      operation: {
        query: isAdmin,
        create: () => true,
        update: () => false,
        delete: isAdmin,
      },
    },
  }),

  // =================================================================
  // NAVIGATION & MENUS (mantido como estava)
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
        ui: { description: 'Unique identifier (e.g., main-menu, footer-menu)' },
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
        ui: { displayMode: 'select' }
      }),
      location: select({
        options: [
          { label: '📱 Header Menu', value: 'header' },
          { label: '📱 Mobile Menu', value: 'mobile' },
          { label: '🦶 Footer Menu', value: 'footer' },
          { label: '👤 User Menu', value: 'user' },
          { label: '📋 Sidebar Menu', value: 'sidebar' },
        ],
        defaultValue: 'header',
      }),
      description: text({ ui: { displayMode: 'textarea' } }),
      isActive: checkbox({ defaultValue: true }),
      cssClass: text(),
      maxDepth: integer({ defaultValue: 3 }),
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
        ui: { description: 'URL or path' }
      }),
      type: select({
        options: [
          { label: '🏠 Internal Page', value: 'internal' },
          { label: '🔗 External Link', value: 'external' },
          { label: '📧 Email', value: 'email' },
          { label: '📞 Phone', value: 'phone' },
          { label: '⚓ Anchor/Section', value: 'anchor' },
        ],
        defaultValue: 'internal',
      }),
      target: select({
        options: [
          { label: 'Same Window', value: '_self' },
          { label: 'New Tab', value: '_blank' },
          { label: 'Modal', value: '_modal' },
        ],
        defaultValue: '_self',
      }),
      icon: text(),
      description: text({ ui: { displayMode: 'textarea' } }),
      order: integer({ defaultValue: 0 }),
      isActive: checkbox({ defaultValue: true }),
      isHighlighted: checkbox({ defaultValue: false }),
      requiresAuth: checkbox({ defaultValue: false }),
      cssClass: text(),
      
      // Relationships
      menu: relationship({ 
        ref: 'Menu.items', 
        validation: { isRequired: true }
      }),
      page: relationship({ 
        ref: 'Page',
        ui: { description: 'Link to internal page (optional)' }
      }),
      parentItem: relationship({ 
        ref: 'MenuItem.children',
        ui: { description: 'Parent menu item (for submenus)' }
      }),
      children: relationship({ 
        ref: 'MenuItem.parentItem', 
        many: true
      }),
      
      clickCount: integer({ 
        defaultValue: 0,
        ui: { itemView: { fieldMode: 'read' } }
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
    },
    hooks: {
      resolveInput: ({ resolvedData }) => {
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

  // =================================================================
  // LEGACY CONTENT (for backward compatibility)
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
        ui: { displayMode: 'textarea' },
        validation: { isRequired: true }
      }),
      language: select({
        options: SUPPORTED_LANGUAGES,
        defaultValue: 'pt-BR',
        validation: { isRequired: true },
      }),
      status: select({
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
          { label: 'Archived', value: 'archived' },
        ],
        defaultValue: 'draft',
      }),
      publishedAt: timestamp(),
      seoTitle: text(),
      seoDescription: text({ ui: { displayMode: 'textarea' } }),
      featuredImage: text(),
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
      description: 'Legacy content system - use Pages for new content'
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
};