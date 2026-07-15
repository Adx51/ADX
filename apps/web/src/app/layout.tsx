import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ADX — Cave à vin',
  description: 'Gestion de cave à vin premium propulsée par l’IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body>{children}</body>
    </html>
  );
}
