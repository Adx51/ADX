import {
  LayoutDashboard,
  Wine,
  Grid3x3,
  Sparkles,
  ScanLine,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

// Shared by the desktop sidebar and the mobile bottom bar.
export const NAV: NavItem[] = [
  { href: '/', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboard },
  { href: '/bottles', label: 'Mes bouteilles', short: 'Bouteilles', icon: Wine },
  { href: '/cellar', label: 'Ma cave', short: 'Cave', icon: Grid3x3 },
  { href: '/sommelier', label: 'Sommelier IA', short: 'Sommelier', icon: Sparkles },
  { href: '/scan', label: 'Scanner', short: 'Scan', icon: ScanLine },
  { href: '/portfolio', label: 'Patrimoine', short: 'Patrimoine', icon: TrendingUp },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}
