import { NextResponse, type NextRequest } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/api';

const PUBLIC_PATHS = ['/login', '/register'];

/**
 * Route guard: redirects unauthenticated users to /login, and authenticated
 * users away from the auth pages. Token validity is enforced server-side by the
 * (app) layout + the API; here we only check for the cookie's presence.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasToken = Boolean(req.cookies.get(TOKEN_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasToken && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (hasToken && isPublic) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals, static assets, and the API proxy
  // path (`/api/*` is forwarded to the backend, which enforces its own auth).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
