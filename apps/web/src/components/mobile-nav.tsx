'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, isActive } from '@/lib/nav';

// Bottom tab bar for phones (hidden ≥ md, where the sidebar takes over).
// Gives the PWA a native-app feel when added to the iOS home screen.
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-ink-800/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map(({ href, short, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
              active ? 'text-gold-400' : 'text-neutral-500'
            }`}
          >
            <Icon size={20} />
            <span className="leading-none">{short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
