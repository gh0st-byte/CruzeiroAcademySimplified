// schema.ts
import { list } from '@keystone-6/core';
import {
  text,
  timestamp,
  relationship,
  select,
  checkbox,
  password
} from '@keystone-6/core/fields';


// ======================
// Admin
// ======================

export const lists = {
  User: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      email: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
      password: password({ validation: { isRequired: true } }),
      isAdmin: checkbox({
        defaultValue: false,
        label: 'Administrador?',
      }),
      role: select({
        options: [
          { label: 'Super Admin', value: 'super_admin' },
          { label: 'Editor', value: 'editor' },
          { label: 'Viewer', value: 'viewer' },
        ],
        defaultValue: 'viewer',
        ui: { displayMode: 'segmented-control' },
      }),
    },
    ui: {
      listView: {
        initialColumns: ['name', 'email', 'isAdmin', 'role'],
      },
    },
  }),
};

// ======================
// School
// ======================
export const School = list({
  acess: allowAll,
  fields: {
    name: text({ validation: { isRequired: true } }),
    country: text({ validation: { isRequired: true } }),
    city: text(),
    slug: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    description: text(),
    status: select({
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
    }),
    photos: relationship({ ref: 'Photo.school', many: true }),
    formLinks: relationship({ ref: 'FormLink.school', many: true }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp({
      db: { updatedAt: true },
    }),
  },
});

// ======================
// Photo
// ======================
export const Photo = list({
  acess: allowAll,
  fields: {
    fileUrl: text({ validation: { isRequired: true } }),
    altText: text(),
    language: select({
      options: [
        { label: 'Português (Brasil)', value: 'pt-BR' },
        { label: 'Inglês (EUA)', value: 'en-US' },
        { label: 'Japonês', value: 'ja-JP' },
        { label: 'tailandês', value: 'th-TH' },
        { label: 'Espanhol (Colômbia)', value: 'es-CO' },
        { label: 'Espanhol (Peru)', value: 'es-PE' },
      ],
      defaultValue: 'pt-BR',
      ui: { displayMode: 'segmented-control' }, // aparece como botões
    }),
    isActive: checkbox({ defaultValue: true }),
    school: relationship({ ref: 'School.photos', many: false }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
  },
  ui: {
    listView: {
      initialColumns: ['fileUrl', 'language', 'isActive', 'school'],
      initialSort: { field: 'createdAt', direction: 'DESC' },
    },
  },
});

// ======================
// FormLink
// ======================
export const FormLink = list({
  acess: allowAll,
  fields: {
    school: relationship({ ref: 'School.formLinks' }),
    url: text({ validation: { isRequired: true } }),
    tag: text({ validation: { isRequired: true } }), // idioma ex: pt-BR
    description: text(),
    isActive: checkbox({ defaultValue: true }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
});
