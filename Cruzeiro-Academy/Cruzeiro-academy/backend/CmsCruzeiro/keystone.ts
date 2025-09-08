// keystone.ts
import { config } from '@keystone-6/core';
import { School, Photo, FormLink } from './schema';
import { lists } from './schema';
import { statelessSessions } from '@keystone-6/core/session';
import { createAuth } from '@keystone-6/auth';

const sessionSecret = process.env.SESSION_SECRET || 'um-segredo-forte';
const sessionMaxAge = 60 * 60 * 24 * 30; // 30 dias

const { withAuth } = createAuth({
  listKey: 'User',
  identityField: 'email',
  secretField: 'password',
  initFirstItem: {
    fields: ['name', 'email', 'password'],
    itemData: {
      isAdmin: true,
      role: 'super_admin',
    },
  },
});

const session = statelessSessions({
  maxAge: sessionMaxAge,
  secret: sessionSecret,
});

export default withAuth(
  config({
    db: {
      provider: 'postgresql',
      url: process.env.DATABASE_URL!,
    },
    lists,
    session,
  })
);




export default config({
  db: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
  lists: {
    School,
    Photo,
    FormLink,
  },
  server: {
    port: 3000,
    cors: { origin: ['http://localhost:3000'], credentials: true },
  },
});
