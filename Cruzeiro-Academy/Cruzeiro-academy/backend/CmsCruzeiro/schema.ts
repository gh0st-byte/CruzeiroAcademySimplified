// Bem-vindo ao seu schema
//   O desenvolvimento orientado a schema é o modo de operação do Keystone
//
// Este arquivo é onde definimos as listas, campos e hooks para nossos dados.
// Se quiser saber mais sobre como as listas são configuradas, leia
// - https://keystonejs.com/docs/config/lists

import { list } from '@keystone-6/core'
import { allowAll } from '@keystone-6/core/access'
import {
  text,
  relationship,
  password,
  timestamp,
} from '@keystone-6/core/fields'
import { document } from '@keystone-6/fields-document'
import type { Lists } from '.keystone/types'

// veja https://keystonejs.com/docs/fields/overview para a lista completa de campos
//   aqui estão alguns campos comuns como exemplo


// o campo document é mais complexo, então tem seu próprio pacote
// se quiser criar seus próprios campos, veja https://keystonejs.com/docs/guides/custom-fields

// ao usar Typescript, você pode refinar seus tipos para um subconjunto mais restrito importando
// os tipos gerados de '.keystone/types'

export const lists = {
  User: list({
    // AVISO
    //   neste projeto inicial, qualquer pessoa pode criar, consultar, atualizar e deletar qualquer coisa
    //   se quiser evitar que pessoas aleatórias na internet acessem seus dados,
    //   saiba mais em https://keystonejs.com/docs/guides/auth-and-access-control
    access: allowAll,

    // estes são os campos da nossa lista User
    fields: {
      // ao adicionar isRequired, garantimos que todo User deve ter um nome
      //   se nenhum nome for fornecido, um erro será exibido
      name: text({ validation: { isRequired: true } }),

      email: text({
        validation: { isRequired: true },
        // ao adicionar isIndexed: 'unique', estamos dizendo que nenhum usuário pode ter o mesmo
        // email que outro usuário - isso pode ou não ser uma boa ideia para seu projeto
        isIndexed: 'unique',
      }),

      password: password({ validation: { isRequired: true } }),

      // podemos usar este campo para ver quais Posts este User escreveu
      //   mais sobre isso na lista Post abaixo
      posts: relationship({ ref: 'Post.author', many: true }),

      createdAt: timestamp({
        // define o timestamp para Date.now() quando o usuário é criado
        defaultValue: { kind: 'now' },
      }),
    },
  }),

  Post: list({
    // AVISO
    //   neste projeto inicial, qualquer pessoa pode criar, consultar, atualizar e deletar qualquer coisa
    //   se quiser evitar que pessoas aleatórias na internet acessem seus dados,
    //   saiba mais em https://keystonejs.com/docs/guides/auth-and-access-control
    access: allowAll,

    // estes são os campos da nossa lista Post
    fields: {
      title: text({ validation: { isRequired: true } }),

      // o campo document pode ser usado para criar conteúdo rico editável
      //   saiba mais em https://keystonejs.com/docs/guides/document-fields
      content: document({
        formatting: true,
        layouts: [
          [1, 1],
          [1, 1, 1],
          [2, 1],
          [1, 2],
          [1, 2, 1],
        ],
        links: true,
        dividers: true,
      }),

      // com este campo, você pode definir um User como autor de um Post
      author: relationship({
        // poderíamos ter usado 'User', mas aí o relacionamento seria apenas 1-via
        ref: 'User.posts',

        // algumas customizações para mudar como isso aparece no AdminUI
        ui: {
          displayMode: 'cards',
          cardFields: ['name', 'email'],
          inlineEdit: { fields: ['name', 'email'] },
          linkToItem: true,
          inlineConnect: true,
        },

        // um Post só pode ter um autor
        //   este é o padrão, mas mostramos aqui por clareza
        many: false,
      }),

      // com este campo, você pode adicionar algumas Tags aos Posts
      tags: relationship({
        // poderíamos ter usado 'Tag', mas aí o relacionamento seria apenas 1-via
        ref: 'Tag.posts',

        // um Post pode ter várias Tags, não apenas uma
        many: true,

        // algumas customizações para mudar como isso aparece no AdminUI
        ui: {
          displayMode: 'cards',
          cardFields: ['name'],
          inlineEdit: { fields: ['name'] },
          linkToItem: true,
          inlineConnect: true,
          inlineCreate: { fields: ['name'] },
        },
      }),
    },
  }),

  // esta última lista é nossa lista Tag, que só tem um campo name por enquanto
  Tag: list({
    // AVISO
    //   neste projeto inicial, qualquer pessoa pode criar, consultar, atualizar e deletar qualquer coisa
    //   se quiser evitar que pessoas aleatórias na internet acessem seus dados,
    //   saiba mais em https://keystonejs.com/docs/guides/auth-and-access-control
    access: allowAll,

    // definir como isHidden para a interface do usuário impede que esta lista seja visível no Admin UI
    ui: {
      isHidden: true,
    },

    // estes são os campos da nossa lista Tag
    fields: {
      name: text(),
      // isso pode ser útil para descobrir todos os Posts associados a uma Tag
      posts: relationship({ ref: 'Post.tags', many: true }),
    },
  }),
} satisfies Lists;


