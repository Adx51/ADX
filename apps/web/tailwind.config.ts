import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep wine-cellar palette
        bordeaux: {
          50: '#fbf2f4',
          100: '#f7e3e8',
          400: '#c05a72',
          500: '#a03050',
          600: '#7d1f3d',
          700: '#5e1730',
          900: '#3a0e1e',
        },
        gold: {
          400: '#e9c46a',
          500: '#d4a437',
          600: '#b8860b',
        },
        ink: {
          900: '#0a0a0c',
          800: '#111114',
          700: '#1a1a1f',
          600: '#26262d',
          500: '#3a3a44',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
