import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ADX — Cave à vin',
  description: 'Gestion de cave à vin premium propulsée par l’IA',
  // Launch full-screen (no Safari chrome) when added to the iOS home screen.
  appleWebApp: {
    capable: true,
    title: 'ADX',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body>{children}</body>
    </html>
  );
}
