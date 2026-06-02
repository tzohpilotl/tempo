import { User } from '../database/entities/user.entity';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Merges with Express.User so req.user is typed as our User entity
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends import('../database/entities/user.entity').User {}

    interface Request {
      user?: User;
    }
  }
}

// Extend express-session to include Passport's regenerate/save methods
// that @nestjs/passport expects on the session object
declare module 'express-session' {
  interface SessionData {
    passport?: {
      user?: string;
    };
  }
}
