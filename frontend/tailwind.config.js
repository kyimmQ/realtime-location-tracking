/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./driver.html",
    "./admin.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ─── Brand & Semantic Colors ──────────────────────────────────────────────
      colors: {
        brand: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',   // primary
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // Role-specific accents
        customer: {
          50:  '#FFF7ED',
          500: '#F97316',   // same as brand-500
          600: '#EA580C',
          700: '#C2410C',
        },
        driver: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          400: '#60A5FA',
          500: '#3B82F6',   // blue
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
        },
        admin: {
          50:  '#F5F3FF',
          100: '#EDE9FE',
          400: '#A78BFA',
          500: '#6366F1',   // indigo
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
        },
        // Neutrals
        surface: {
          50:  '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
        },
        // Sidebar dark (deshipping design system)
        sidebar: {
          DEFAULT: '#3A2E25',
          hover: '#4A3D32',
          active: '#5C4D3C',
          border: '#4A3D32',
          text: '#FFFFFF',
          textMuted: '#C8B8A4',
        },
        // Kinetic Flow surface hierarchy (cream/warm base)
        'surface-base': '#FFF8F5',
        'surface-container': {
          lowest: '#FFFFFF',
          low: '#FFF1E9',
          DEFAULT: '#FFEADD',
          high: '#F9E4D7',
          highest: '#F3DFD1',
        },
      },

      // ─── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Manrope', '"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        headline: ['"Plus Jakarta Sans"', 'Manrope', '"DM Sans"', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-sm': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },

      // ─── Shadows ─────────────────────────────────────────────────────────────
      boxShadow: {
        'card':        '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-hover':  '0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        'navbar':      '0 1px 0 0 rgb(0 0 0 / 0.06)',
        'glass':       '0 8px 32px 0 rgb(0 0 0 / 0.08)',
        'glow-orange': '0 0 20px 0 rgb(249 115 22 / 0.25)',
        'glow-blue':   '0 0 20px 0 rgb(59 130 246 / 0.25)',
        'glow-indigo': '0 0 20px 0 rgb(99 102 241 / 0.25)',
      },

      // ─── Border Radius ───────────────────────────────────────────────────────
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      // ─── Animations ──────────────────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-ring': {
          '0%':   { transform: 'scale(0.95)', opacity: '0.8' },
          '50%':  { transform: 'scale(1.05)', opacity: '0.4' },
          '100%': { transform: 'scale(0.95)', opacity: '0.8' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.6', transform: 'scale(1.3)' },
        },
        'breathe': {
          '0%, 100%': { opacity: '0.6' },
          '50%':       { opacity: '1' },
        },
        'spin-slow': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'bounce-in': {
          '0%':   { transform: 'scale(0.9)', opacity: '0' },
          '60%':  { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in':       'fade-in 0.3s ease-out',
        'slide-up':      'slide-up 0.4s ease-out',
        'slide-in-right':'slide-in-right 0.35s ease-out',
        'pulse-ring':    'pulse-ring 2s ease-in-out infinite',
        'pulse-dot':     'pulse-dot 1.5s ease-in-out infinite',
        'breathe':        'breathe 2s ease-in-out infinite',
        'spin-slow':     'spin-slow 3s linear infinite',
        'shimmer':       'shimmer 2s linear infinite',
        'bounce-in':     'bounce-in 0.35s ease-out',
        'float':         'float 3s ease-in-out infinite',
      },

      // ─── Z-Index Scale ───────────────────────────────────────────────────────
      zIndex: {
        'base':   '0',
        'raised':  '10',
        'overlay':'50',
        'modal':  '100',
        'toast':  '200',
      },

      // ─── Spacing for map containers ──────────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },

      // ─── Backdrop blur ───────────────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
