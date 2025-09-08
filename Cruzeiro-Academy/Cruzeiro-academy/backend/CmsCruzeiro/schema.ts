import { list } from '@keystone-6/core';
import { text, password, relationship, timestamp, checkbox, select, json, integer, bigInt, float, virtual, calendarDay } from '@keystone-6/core/fields';

// =================================================================
// ACCESS CONTROL FUNCTIONS - Multi-tenant Security
// =================================================================
function isAdmin({ session }) {
  return !!session?.data && ['admin', 'super_admin'].includes(session.data.role);
}

function isEditor({ session }) {
  return !!session?.data && ['admin', 'super_admin', 'editor'].includes(session.data.role);
}

function canViewUser({ session, item }) {
  if (!session?.data) return false;
  if (['admin', 'super_admin'].includes(session.data.role)) return true;
  return session.data.id === item.id;
}

function allowAll() {
  return true;
}

export const lists = {
  // Schools (Tenants) - Multi-tenancy structure
  School: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      country: text({ validation: { isRequired: true } }),
      country_name: text({ validation: { isRequired: true } }),
      language: select({
        options: [
          { label: 'Português (Brasil)', value: 'pt-BR' },
          { label: 'Inglês (EUA)', value: 'en-US' },
          { label: 'Espanhol (Colombia e Peru)', value: 'es-ES' },
          { label: 'Japonês (Japão)', value: 'ja-JP' },
        ],
        defaultValue: 'pt-BR',
        validation: { isRequired: true },
      }),
      domain: text({ isIndexed: 'unique', validation: { isRequired: true } }),
      slug: text({ isIndexed: 'unique', validation: { isRequired: true } }),
      status: select({
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
          { label: 'Maintenance', value: 'maintenance' },
        ],
        defaultValue: 'active',
      }),
      settings: json({ defaultValue: {} }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships
      cms_users: relationship({ ref: 'CmsUser.tenant', many: true }),
      contents: relationship({ ref: 'Content.tenant', many: true }),
      categories: relationship({ ref: 'ContentCategory.tenant', many: true }),
      media_files: relationship({ ref: 'MediaFile.tenant', many: true }),
      navigation_menus: relationship({ ref: 'NavigationMenu.tenant', many: true }),
      site_settings: relationship({ ref: 'SiteSetting.tenant', many: true }),
      sections: relationship({ ref: 'Section.tenant', many: true }),
    },
    db: { map: 'schools' },
    access: {
      operation: {
        query: () => true,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
      },
    },
  }),

  // CMS Users with multi-tenancy
  CmsUser: list({
    fields: {
      tenant: relationship({ ref: 'School.cms_users', validation: { isRequired: true } }),
      email: text({ isIndexed: 'unique', validation: { isRequired: true } }),
      password: password(),
      first_name: text({ validation: { isRequired: true } }),
      last_name: text({ validation: { isRequired: true } }),
      role: select({
        options: [
          { label: 'Super Admin', value: 'super_admin' },
          { label: 'Admin', value: 'admin' },
          { label: 'Editor', value: 'editor' },
          { label: 'Viewer', value: 'viewer' },
        ],
        defaultValue: 'editor',
      }),
      avatar_url: text(),
      is_active: checkbox({ defaultValue: true }),
      last_login: timestamp(),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships
      authored_contents: relationship({ ref: 'Content.author', many: true }),
      uploaded_media: relationship({ ref: 'MediaFile.uploaded_by', many: true }),
      updated_settings: relationship({ ref: 'SiteSetting.updated_by', many: true }),
    },
    db: { map: 'cms_users' },
    access: {
      operation: {
        query: ({ session }) => !!session?.data,
        create: isAdmin,
        update: canViewUser,
        delete: isAdmin,
      },
    },
  }),

  // Content Categories
  ContentCategory: list({
    fields: {
      tenant: relationship({ ref: 'School.categories', validation: { isRequired: true } }),
      name: text({ validation: { isRequired: true } }),
      slug: text({ validation: { isRequired: true } }),
      description: text({ ui: { displayMode: 'textarea' } }),
      parent: relationship({ ref: 'ContentCategory.children' }),
      children: relationship({ ref: 'ContentCategory.parent', many: true }),
      sort_order: integer({ defaultValue: 0 }),
      is_active: checkbox({ defaultValue: true }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships
      contents: relationship({ ref: 'Content.category', many: true }),
    },
    db: { map: 'content_categories' },
    access: {
      operation: {
        query: ({ session }) => !!session?.data,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Contents
  Content: list({
    fields: {
      tenant: relationship({ ref: 'School.contents', validation: { isRequired: true } }),
      category: relationship({ ref: 'ContentCategory.contents' }),
      author: relationship({ ref: 'CmsUser.authored_contents', validation: { isRequired: true } }),
      title: text({ validation: { isRequired: true } }),
      slug: text({ validation: { isRequired: true } }),
      excerpt: text({ ui: { displayMode: 'textarea' } }),
      body: text({ ui: { displayMode: 'textarea' }, validation: { isRequired: true } }),
      featured_image_url: text(),
      meta_title: text(),
      meta_description: text(),
      status: select({
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
          { label: 'Archived', value: 'archived' },
          { label: 'Scheduled', value: 'scheduled' },
        ],
        defaultValue: 'draft',
      }),
      language: text({ validation: { isRequired: true }, defaultValue: 'pt-BR' }),
      content_type: select({
        options: [
          { label: 'Article', value: 'article' },
          { label: 'Page', value: 'page' },
          { label: 'News', value: 'news' },
          { label: 'Event', value: 'event' },
        ],
        defaultValue: 'article',
      }),
      is_featured: checkbox({ defaultValue: false }),
      view_count: integer({ defaultValue: 0 }),
      sort_order: integer({ defaultValue: 0 }),
      published_at: timestamp(),
      expires_at: timestamp(),
      scheduled_at: timestamp(),
      seo_settings: json({ defaultValue: {} }),
      custom_fields: json({ defaultValue: {} }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships
      menu_items: relationship({ ref: 'NavigationMenuItem.content', many: true }),
    },
    db: { map: 'contents' },
    access: {
      operation: {
        query: ({ session }) => !!session?.data,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Media Files
  MediaFile: list({
    fields: {
      tenant: relationship({ ref: 'School.media_files', validation: { isRequired: true } }),
      uploaded_by: relationship({ ref: 'CmsUser.uploaded_media', validation: { isRequired: true } }),
      filename: text({ validation: { isRequired: true } }),
      original_filename: text({ validation: { isRequired: true } }),
      file_path: text({ validation: { isRequired: true } }),
      file_url: text({ validation: { isRequired: true } }),
      mime_type: text({ validation: { isRequired: true } }),
      file_size: bigInt({ validation: { isRequired: true } }),
      width: integer(),
      height: integer(),
      alt_text: text(),
      caption: text({ ui: { displayMode: 'textarea' } }),
      is_active: checkbox({ defaultValue: true }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships  
      carousel_images: relationship({ ref: 'CarouselImage.media', many: true }),
      image_banners: relationship({ ref: 'ImageBanner.media', many: true }),
    },
    db: { map: 'media_files' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Navigation Menus
  NavigationMenu: list({
    fields: {
      tenant: relationship({ ref: 'School.navigation_menus', validation: { isRequired: true } }),
      name: text({ validation: { isRequired: true } }),
      slug: text({ validation: { isRequired: true } }),
      location: select({
        options: [
          { label: 'Header', value: 'header' },
          { label: 'Footer', value: 'footer' },
          { label: 'Sidebar', value: 'sidebar' },
        ],
        validation: { isRequired: true },
      }),
      is_active: checkbox({ defaultValue: true }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships
      menu_items: relationship({ ref: 'NavigationMenuItem.menu', many: true }),
    },
    db: { map: 'navigation_menus' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Navigation Menu Items
  NavigationMenuItem: list({
    fields: {
      menu: relationship({ ref: 'NavigationMenu.menu_items', validation: { isRequired: true } }),
      parent: relationship({ ref: 'NavigationMenuItem.children' }),
      children: relationship({ ref: 'NavigationMenuItem.parent', many: true }),
      title: text({ validation: { isRequired: true } }),
      url: text(),
      content: relationship({ ref: 'Content.menu_items' }),
      target: select({
        options: [
          { label: 'Same Window', value: '_self' },
          { label: 'New Window', value: '_blank' },
        ],
        defaultValue: '_self',
      }),
      css_class: text(),
      sort_order: integer({ defaultValue: 0 }),
      is_active: checkbox({ defaultValue: true }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'navigation_menu_items' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Site Settings
  SiteSetting: list({
    fields: {
      tenant: relationship({ ref: 'School.site_settings', validation: { isRequired: true } }),
      setting_key: text({ validation: { isRequired: true } }),
      setting_value: text({ ui: { displayMode: 'textarea' } }),
      setting_type: select({
        options: [
          { label: 'Text', value: 'text' },
          { label: 'Boolean', value: 'boolean' },
          { label: 'JSON', value: 'json' },
          { label: 'Number', value: 'number' },
        ],
        defaultValue: 'text',
      }),
      description: text({ ui: { displayMode: 'textarea' } }),
      is_public: checkbox({ defaultValue: false }),
      updated_by: relationship({ ref: 'CmsUser.updated_settings' }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'site_settings' },
    access: {
      operation: {
        query: () => true,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
      },
    },
  }),

  // =================================================================
  // SISTEMA DE PÁGINAS POR BLOCOS PARA LANDING PAGES
  // =================================================================

  // Sections - Áreas da página (home, about, contact, etc.)
  Section: list({
    fields: {
      tenant: relationship({ ref: 'School.sections', validation: { isRequired: true } }),
      key: text({ isIndexed: 'unique', validation: { isRequired: true } }),
      title: text({ validation: { isRequired: true } }),
      description: text({ ui: { displayMode: 'textarea' } }),
      is_active: checkbox({ defaultValue: true }),
      sort_order: integer({ defaultValue: 0 }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships
      blocks: relationship({ ref: 'Block.section', many: true }),
    },
    db: { map: 'sections' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
    ui: {
      listView: {
        initialColumns: ['title', 'key', 'sort_order', 'is_active'],
      },
    },
  }),

  // Blocks - Elementos dentro das seções
  Block: list({
    fields: {
      section: relationship({ ref: 'Section.blocks', validation: { isRequired: true } }),
      type: select({
        options: [
          { label: 'Carousel', value: 'carousel' },
          { label: 'Rich Text', value: 'richText' },
          { label: 'Image Banner', value: 'imageBanner' },
          { label: 'Video Embed', value: 'videoEmbed' },
          { label: 'Custom Block', value: 'customBlock' },
        ],
        validation: { isRequired: true },
      }),
      title: text({ validation: { isRequired: true } }),
      order: integer({ defaultValue: 0 }),
      visible: checkbox({ defaultValue: true }),
      data: json({ defaultValue: {} }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships to specific elements
      carousel: relationship({ ref: 'Carousel.block' }),
      rich_text: relationship({ ref: 'RichText.block' }),
      image_banner: relationship({ ref: 'ImageBanner.block' }),
      video_embed: relationship({ ref: 'VideoEmbed.block' }),
      custom_block: relationship({ ref: 'CustomBlock.block' }),
    },
    db: { map: 'blocks' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
    ui: {
      listView: {
        initialColumns: ['title', 'type', 'order', 'visible'],
      },
    },
  }),

  // Carousel Element
  Carousel: list({
    fields: {
      block: relationship({ ref: 'Block.carousel', validation: { isRequired: true } }),
      name: text({ validation: { isRequired: true } }),
      autoplay: checkbox({ defaultValue: true }),
      interval_ms: integer({ defaultValue: 5000 }),
      show_arrows: checkbox({ defaultValue: true }),
      show_dots: checkbox({ defaultValue: true }),
      aspect_ratio: text({ defaultValue: '16:9' }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
      
      // Relationships
      images: relationship({ ref: 'CarouselImage.carousel', many: true }),
    },
    db: { map: 'carousels' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Carousel Images
  CarouselImage: list({
    fields: {
      carousel: relationship({ ref: 'Carousel.images', validation: { isRequired: true } }),
      media: relationship({ ref: 'MediaFile.carousel_images' }),
      url: text({ validation: { isRequired: true } }),
      alt: text(),
      caption: text({ ui: { displayMode: 'textarea' } }),
      link_url: text(),
      order: integer({ defaultValue: 0 }),
      is_active: checkbox({ defaultValue: true }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'carousel_images' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
    ui: {
      listView: {
        initialColumns: ['carousel', 'alt', 'order', 'is_active'],
      },
    },
  }),

  // Rich Text Element
  RichText: list({
    fields: {
      block: relationship({ ref: 'Block.rich_text', validation: { isRequired: true } }),
      name: text({ validation: { isRequired: true } }),
      content: json({ validation: { isRequired: true } }),
      text_align: select({
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
          { label: 'Justify', value: 'justify' },
        ],
        defaultValue: 'left',
      }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'rich_texts' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Image Banner Element
  ImageBanner: list({
    fields: {
      block: relationship({ ref: 'Block.image_banner', validation: { isRequired: true } }),
      name: text({ validation: { isRequired: true } }),
      media: relationship({ ref: 'MediaFile.image_banners' }),
      url: text({ validation: { isRequired: true } }),
      alt: text(),
      link_url: text(),
      overlay_text: text({ ui: { displayMode: 'textarea' } }),
      overlay_position: select({
        options: [
          { label: 'Top Left', value: 'top-left' },
          { label: 'Top Center', value: 'top-center' },
          { label: 'Top Right', value: 'top-right' },
          { label: 'Center Left', value: 'center-left' },
          { label: 'Center', value: 'center' },
          { label: 'Center Right', value: 'center-right' },
          { label: 'Bottom Left', value: 'bottom-left' },
          { label: 'Bottom Center', value: 'bottom-center' },
          { label: 'Bottom Right', value: 'bottom-right' },
        ],
        defaultValue: 'center',
      }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'image_banners' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Video Embed Element
  VideoEmbed: list({
    fields: {
      block: relationship({ ref: 'Block.video_embed', validation: { isRequired: true } }),
      name: text({ validation: { isRequired: true } }),
      provider: select({
        options: [
          { label: 'YouTube', value: 'youtube' },
          { label: 'Vimeo', value: 'vimeo' },
          { label: 'Twitch', value: 'twitch' },
          { label: 'Direct URL', value: 'direct' },
        ],
        validation: { isRequired: true },
      }),
      video_id: text({ validation: { isRequired: true } }),
      video_url: text(),
      title: text(),
      description: text({ ui: { displayMode: 'textarea' } }),
      thumbnail_url: text(),
      autoplay: checkbox({ defaultValue: false }),
      controls: checkbox({ defaultValue: true }),
      mute: checkbox({ defaultValue: false }),
      loop: checkbox({ defaultValue: false }),
      aspect_ratio: text({ defaultValue: '16:9' }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'video_embeds' },
    access: {
      operation: {
        query: () => true,
        create: isEditor,
        update: isEditor,
        delete: isAdmin,
      },
    },
  }),

  // Custom Block Element
  CustomBlock: list({
    fields: {
      block: relationship({ ref: 'Block.custom_block', validation: { isRequired: true } }),
      name: text({ validation: { isRequired: true } }),
      component_name: text({ validation: { isRequired: true } }),
      data: json({ defaultValue: {} }),
      css_classes: text(),
      inline_styles: json({ defaultValue: {} }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'custom_blocks' },
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
  // AUDIT & MONITORING TABLES
  // =================================================================

  // Audit Logs for security tracking
  AuditLog: list({
    fields: {
      tenant: relationship({ ref: 'School' }),
      user: relationship({ ref: 'CmsUser' }),
      table_name: text({ validation: { isRequired: true } }),
      record_id: text(),
      operation: select({
        options: [
          { label: 'Insert', value: 'INSERT' },
          { label: 'Update', value: 'UPDATE' },
          { label: 'Delete', value: 'DELETE' },
          { label: 'Select', value: 'SELECT' },
        ],
        validation: { isRequired: true },
      }),
      old_values: json(),
      new_values: json(),
      ip_address: text(),
      user_agent: text({ ui: { displayMode: 'textarea' } }),
      session_id: text(),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'audit_logs' },
    access: {
      operation: {
        query: isAdmin,
        create: () => false, // Criados automaticamente por triggers
        update: () => false, // Imutáveis
        delete: isAdmin,     // Apenas admin pode limpar logs
      },
    },
    ui: {
      listView: {
        initialColumns: ['table_name', 'operation', 'user', 'created_at'],
      },
      hideCreate: true,
      hideDelete: false,
    },
  }),

  // User Sessions for authentication tracking
  UserSession: list({
    fields: {
      user: relationship({ ref: 'CmsUser', validation: { isRequired: true } }),
      session_token: text({ isIndexed: 'unique', validation: { isRequired: true } }),
      ip_address: text(),
      user_agent: text({ ui: { displayMode: 'textarea' } }),
      is_active: checkbox({ defaultValue: true }),
      expires_at: timestamp({ validation: { isRequired: true } }),
      created_at: timestamp({ defaultValue: { kind: 'now' } }),
      updated_at: timestamp({ defaultValue: { kind: 'now' } }),
    },
    db: { map: 'user_sessions' },
    access: {
      operation: {
        query: isAdmin,
        create: () => false, // Criadas pela autenticação
        update: () => false, // Gerenciadas pelo sistema
        delete: isAdmin,     // Admin pode remover sessões
      },
    },
    ui: {
      listView: {
        initialColumns: ['user', 'is_active', 'expires_at', 'created_at'],
      },
      hideCreate: true,
    },
  }),

  // Connection Statistics for monitoring
  ConnectionStat: list({
    fields: {
      timestamp: timestamp({ defaultValue: { kind: 'now' }, validation: { isRequired: true } }),
      active_connections: integer({ validation: { isRequired: true } }),
      total_connections: integer({ validation: { isRequired: true } }),
      slow_queries: integer({ defaultValue: 0 }),
      cpu_usage: float(),
      memory_usage: float(),
      disk_usage: float(),
    },
    db: { map: 'connection_stats' },
    access: {
      operation: {
        query: isAdmin,
        create: () => false, // Criadas por sistema de monitoramento
        update: () => false, // Imutáveis
        delete: isAdmin,     // Admin pode limpar estatísticas antigas
      },
    },
    ui: {
      listView: {
        initialColumns: ['timestamp', 'active_connections', 'total_connections', 'cpu_usage'],
      },
      hideCreate: true,
    },
  }),
};
