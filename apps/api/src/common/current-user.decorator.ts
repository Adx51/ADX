import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Resolves the acting user id.
 *
 * For this foundation we read `x-user-id` from the request header, falling back
 * to a `DEMO_USER_ID` env var so the app is usable end-to-end without a login
 * flow. Replace this with a JWT auth guard (Auth.js / Clerk) that populates
 * `req.user` — the call sites (`@CurrentUserId()`) stay unchanged.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    return (
      req.user?.id ??
      (req.headers['x-user-id'] as string | undefined) ??
      process.env.DEMO_USER_ID ??
      'demo'
    );
  },
);
