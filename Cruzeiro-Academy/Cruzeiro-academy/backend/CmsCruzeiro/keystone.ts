import { config } from '@keystone-6/core';
import { lists } from './schema';
import { statelessSessions } from '@keystone-6/core/session';

const sessionSecret = process.env.SESSION_SECRET || 'default_session_secret';
const sessionMaxAge = 60 * 60 * 24 * 30; // 30 days

export default config({
  db: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL || 'postgresql://postgres:Cruzeiro%401921@localhost:5432/keystone_db',
  },
  lists,
  session: statelessSessions({
    secret: process.env.SESSION_SECRET,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  }),
  ui: {
    isAccessAllowed: (context) => !!context.session?.data,
  },
});
