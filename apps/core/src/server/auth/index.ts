import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';

export { createAuthMiddleware } from 'better-auth/api';

export const defineAuth = (options: Omit<BetterAuthOptions, 'database'>) => betterAuth(options);

export const AuthError = APIError;
