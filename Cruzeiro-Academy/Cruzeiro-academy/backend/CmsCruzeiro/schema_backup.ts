import { list } from '@keystone-6/core';
import { text, password, relationship, timestamp, checkbox, select, json, integer } from '@keystone-6/core/fields';

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
};
