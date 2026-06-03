import { type Auth, type BetterAuthOptions, betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';

export { createAuthMiddleware } from 'better-auth/api';

export const defineAuth = <Options extends Omit<BetterAuthOptions, 'database'>>(options: Options): Auth<Options> => betterAuth(options);

export const AuthError = APIError;
