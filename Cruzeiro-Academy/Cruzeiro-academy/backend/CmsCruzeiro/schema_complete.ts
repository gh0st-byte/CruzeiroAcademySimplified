import { list } from '@keystone-6/core';
import { text, password, relationship, timestamp, checkbox, select, json, integer, bigInt } from '@keystone-6/core/fields';

// Define access control functions
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

export const lists = {
  // Schools (Tenants) - Multi-tenancy structure
  School: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      country: text({ validation: { isRequired: true } }),
      country_name: text({ validation: { isRequired: true } }),
      timezone: text({ validation: { isRequired: true } }),
      language: text({ validation: { isRequired: true }, defaultValue: 'pt-BR' }),
      currency: text({ validation: { isRequired: true }, defaultValue: 'BRL' }),
      domain: text({ isIndexed: 'unique' }),
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
      audit_logs: relationship({ ref: 'AuditLog.tenant', many: true }),
      user_sessions: relationship({ ref: 'UserSession.user', many: true }),
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
      password_hash: password(),
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
      audit_logs: relationship({ ref: 'AuditLog.user', many: true }),
      sessions: relationship({ ref: 'UserSession.user', many: true }),
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
    },
    db: { map: 'media_files' },
    access: {
      operation: {
        query: ({ session }) => !!session?.data,
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
        query: ({ session }) => !!session?.data,
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
        query: ({ session }) => !!session?.data,
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
        query: ({ session }) => !!session?.data,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
      },
    },
  }),

  // Audit Logs
  AuditLog: list({
    fields: {
      tenant: relationship({ ref: 'School.audit_logs' }),
      user: relationship({ ref: 'CmsUser.audit_logs' }),
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
        create: () => false, // Only created by triggers
        update: () => false,
        delete: isAdmin,
      },
    },
  }),

  // User Sessions
  UserSession: list({
    fields: {
      user: relationship({ ref: 'CmsUser.sessions', validation: { isRequired: true } }),
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
        create: ({ session }) => !!session?.data,
        update: ({ session }) => !!session?.data,
        delete: isAdmin,
      },
    },
  }),

  // Connection Stats (for monitoring)
  ConnectionStat: list({
    fields: {
      timestamp: timestamp({ defaultValue: { kind: 'now' }, validation: { isRequired: true } }),
      active_connections: integer({ validation: { isRequired: true } }),
      total_connections: integer({ validation: { isRequired: true } }),
      slow_queries: integer({ defaultValue: 0 }),
      cpu_usage: text(), // Decimal stored as text since KeystoneJS doesn't have decimal field
      memory_usage: text(), // Decimal stored as text
      disk_usage: text(), // Decimal stored as text
    },
    db: { map: 'connection_stats' },
    access: {
      operation: {
        query: isAdmin,
        create: () => false, // Only created by monitoring system
        update: () => false,
        delete: isAdmin,
      },
    },
  }),
};
