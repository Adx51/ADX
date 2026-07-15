import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Resolves the acting user id from `req.user`, which is populated by the global
 * `JwtAuthGuard` after verifying the bearer token. On a protected route this is
 * always present; if it is missing the request was not authenticated.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const id = req.user?.id;
    if (!id) throw new UnauthorizedException();
    return id;
  },
);
