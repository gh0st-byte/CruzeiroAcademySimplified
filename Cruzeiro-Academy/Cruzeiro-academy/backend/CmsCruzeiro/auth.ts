// =================================================================
// CRUZEIRO ACADEMY CMS - AUTHENTICATION CONFIGURATION
// Multi-tenant authentication using CmsUser entity
// =================================================================

import { randomBytes } from 'node:crypto'
import { createAuth } from '@keystone-6/auth'
import { statelessSessions } from '@keystone-6/core/session'

// Multi-tenant authentication configuration
const { withAuth } = createAuth({
  listKey: 'CmsUser',
  identityField: 'email',
  sessionData: 'id tenant { id name slug country } first_name last_name email role is_active created_at',
  secretField: 'password',

  // Initial user creation for first setup
  initFirstItem: {
    fields: ['tenant', 'first_name', 'last_name', 'email', 'password', 'role'],
    itemData: {
      role: 'super_admin',
      is_active: true,
    },
  },
})

// statelessSessions uses cookies for session tracking
//   these cookies have an expiry, in seconds
//   we use an expiry of 30 days for this starter
const sessionMaxAge = 60 * 60 * 24 * 30

// you can find out more at https://keystonejs.com/docs/apis/session#session-api
const session = statelessSessions({
  maxAge: sessionMaxAge,
  secret: process.env.SESSION_SECRET,
})

export { withAuth, session }
