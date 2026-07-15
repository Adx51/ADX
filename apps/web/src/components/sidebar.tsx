'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { clearToken } from '@/lib/api-client';
import { NAV, isActive } from '@/lib/nav';
import type { AuthUser } from '@/lib/api';

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-ink-800/60 px-4 py-6 backdrop-blur-xl md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-bordeaux-500 to-bordeaux-700 font-display text-lg font-bold text-white">
          A
        </div>
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-white">
            ADX
          </p>
          <p className="text-[11px] uppercase tracking-widest text-neutral-500">
            Wine Cellar
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-white/[0.06] text-white'
                  : 'text-neutral-400 hover:bg-white/[0.03] hover:text-white'
              }`}
            >
              <Icon
                size={18}
                className={active ? 'text-gold-400' : 'text-neutral-500 group-hover:text-neutral-300'}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bordeaux-700 text-sm font-medium text-white">
          {(user.name ?? user.email).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-200">
            {user.name ?? 'Compte'}
          </p>
          <p className="truncate text-xs text-neutral-500">{user.email}</p>
        </div>
        <button
          onClick={logout}
          title="Se déconnecter"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/5 hover:text-rose-400"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
