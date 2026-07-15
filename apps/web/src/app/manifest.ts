import type { MetadataRoute } from 'next';

// Web app manifest → enables install as a standalone app (iOS "Sur l'écran
// d'accueil", Android "Installer l'application"). Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ADX — Cave à vin',
    short_name: 'ADX',
    description: 'Gestion de cave à vin premium propulsée par l’IA',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0c',
    theme_color: '#0a0a0c',
    lang: 'fr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
