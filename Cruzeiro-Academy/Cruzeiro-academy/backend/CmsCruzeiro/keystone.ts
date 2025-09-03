import { config } from '@keystone-6/core';
import { lists } from './schema';
import { withAuth, session } from './auth';

const sessionSecret = process.env.SESSION_SECRET || 'default_session_secret';

export default withAuth(
  config({
    db: {
      provider: 'postgresql',
      url: process.env.DATABASE_URL || 'postgresql://cruzeiro:cruzeiro1921@localhost:5432/cruzeiro_academy',
      enableLogging: process.env.NODE_ENV === 'development',
      useMigrations: true,
    },
    lists,
    session,
    ui: {
      isAccessAllowed: (context) => !!context.session?.data,
    },
    server: {
      cors: {
        origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
        credentials: true,
      },
    },
  })
);
