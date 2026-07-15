import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TOKEN_COOKIE, type AuthUser } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { Sidebar } from '@/components/sidebar';
import { MobileNav } from '@/components/mobile-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Gate the whole app group: no token → login. The middleware also guards the
  // route, but this resolves the actual user for the sidebar.
  if (!cookies().get(TOKEN_COOKIE)?.value) {
    redirect('/login');
  }

  let user: AuthUser;
  try {
    user = await serverApi().get<AuthUser>('/auth/me');
  } catch {
    // Token present but rejected (expired / API down) → force re-auth.
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      {/* Extra bottom padding on mobile so content clears the bottom tab bar. */}
      <main className="flex-1 overflow-x-hidden px-6 py-8 pb-28 md:px-10 md:pb-8">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
