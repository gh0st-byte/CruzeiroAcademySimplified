import { createAuth } from '@keystone-6/auth';
import { statelessSessions } from '@keystone-6/core/session';

let sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret && process.env.NODE_ENV !== 'production') {
  sessionSecret = 'wcBDHH/kVCTnmVHBc0zGPTD5GFdvpGQBk2UcOgE6lbI=';
}

const { withAuth, session } = createAuth({
  listKey: 'User', 
  identityField: 'email',
  sessionData: 'name role isActive',
  secretField: 'password',
  
  initFirstItem: {
    fields: ['name', 'email', 'password', 'role'],
    itemData: {
      role: 'super_admin',
      isActive: true,
    },
    skipKeystoneWelcome: true,
  },
});

const sessionConfig = statelessSessions({
  maxAge: 60 * 60 * 24 * 30, // 30 days
  secret: sessionSecret,
});

export { withAuth, sessionConfig as session };