import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './src/components/catalyst/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sophisticated Minimal Palette - Bold yet refined
        // Light Mode: Warm whites and deep charcoals
        // Dark Mode: Rich blacks with warm undertones
        
        // Primary Accent - Deep Indigo with warmth
        accent: {
          DEFAULT: '#3730A3', // Indigo-800 - Bold, confident
          light: '#6366F1',   // Indigo-500 - Vibrant 
          muted: '#818CF8',   // Indigo-400 - Soft
          subtle: '#C7D2FE', // Indigo-200 - Whisper
        },
        
        // Surface Colors - The foundation
        surface: {
          // Light mode
          0: '#FFFFFF',       // Pure white
          50: '#FAFAFA',      // Off-white
          100: '#F5F5F5',     // Light gray
          200: '#E5E5E5',     // Border gray
          300: '#D4D4D4',     // Scrollbar hover gray
          400: '#A3A3A3',     // Medium gray
          // Dark mode  
          900: '#0A0A0A',     // Near black
          850: '#121212',     // Elevated black
          800: '#171717',     // Card black
          700: '#262626',     // Border dark
          600: '#404040',     // Scrollbar hover dark
          500: '#525252',     // Medium dark
        },
        
        // Text Colors - Crisp and readable
        ink: {
          DEFAULT: '#0A0A0A', // Near black
          secondary: '#525252', // Gray-600
          muted: '#A3A3A3',   // Gray-400
          ghost: '#D4D4D4',   // Gray-300
          // Dark mode inversions
          inverse: '#FAFAFA',
          'inverse-secondary': '#A3A3A3',
          'inverse-muted': '#737373',
        },
        
        // Semantic Colors - Status indicators
        success: '#059669',   // Emerald-600
        warning: '#D97706',   // Amber-600
        danger: '#DC2626',    // Red-600
        info: '#0284C7',      // Sky-600
        
        // Legacy support
        royal: {
          DEFAULT: '#3730A3',
          light: '#6366F1',
          dark: '#312E81',
          purple: '#4C1D95',
        },
        'ron-white': '#FFFFFF',
        'ron-text': '#0A0A0A',
        'ron-black': '#0A0A0A',
        'ron-smoke': '#121212',
      },
      
      fontFamily: {
        // Display - Elegant serif for headlines
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        // Body - Elegant thin sans with Raleway
        sans: ['Raleway', 'system-ui', '-apple-system', 'sans-serif'],
        // Mono - For code and data
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
        // Legacy
        georgia: ['Georgia', 'serif'],
        raleway: ['Raleway', 'sans-serif'],
      },
      
      fontWeight: {
        'thin': '100',
        'extralight': '200',
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
        'extrabold': '800',
        'black': '900',
        // Legacy
        'raleway-thin': '100',
        'raleway-extralight': '200',
        'raleway-light': '300',
        'raleway-bold': '700',
      },
      
      fontSize: {
        // Fluid type scale
        'display-2xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '300' }],
        'display-xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '300' }],
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.015em', fontWeight: '300' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '400' }],
        'display-sm': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '400' }],
        'body-xl': ['1.25rem', { lineHeight: '1.75', fontWeight: '400' }],
        'body-lg': ['1.125rem', { lineHeight: '1.75', fontWeight: '400' }],
        'body-md': ['1rem', { lineHeight: '1.625', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-xs': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }],
        'label': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
      
      borderRadius: {
        'none': '0',
        'sm': '0.25rem',
        'DEFAULT': '0.5rem',
        'md': '0.625rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        'full': '9999px',
      },
      
      boxShadow: {
        // Sophisticated shadow system
        'subtle': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft': '0 2px 8px -2px rgb(0 0 0 / 0.08)',
        'medium': '0 4px 16px -4px rgb(0 0 0 / 0.1)',
        'bold': '0 8px 32px -8px rgb(0 0 0 / 0.15)',
        'dramatic': '0 24px 64px -16px rgb(0 0 0 / 0.25)',
        // Glow effects
        'glow-accent': '0 0 24px -4px rgb(99 102 241 / 0.35)',
        'glow-accent-lg': '0 0 48px -8px rgb(99 102 241 / 0.4)',
        // Dark mode shadows
        'dark-subtle': '0 1px 2px 0 rgb(0 0 0 / 0.2)',
        'dark-soft': '0 2px 8px -2px rgb(0 0 0 / 0.4)',
        'dark-medium': '0 4px 16px -4px rgb(0 0 0 / 0.5)',
        'dark-bold': '0 8px 32px -8px rgb(0 0 0 / 0.6)',
        // Inner shadows
        'inner-soft': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.04)',
        'inner-dark': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.2)',
        // Legacy
        'glass': '0 8px 32px 0 rgba(55, 48, 163, 0.08)',
        'glass-hover': '0 12px 48px 0 rgba(55, 48, 163, 0.12)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      },
      
      animation: {
        // Sophisticated motion
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-down': 'fadeDown 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        // Legacy
        'slide-in': 'slideIn 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        'glow': 'glow 2s ease-in-out infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // Legacy
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        glow: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
      
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
        '400': '400ms',
        '450': '450ms',
        '600': '600ms',
      },
      
      backdropBlur: {
        'xs': '2px',
        'glass': '40px',
        'glass-light': '20px',
      },
    },
  },
  plugins: [
    // Custom utility classes
    plugin(function({ addUtilities, addBase, theme }) {
      // Base typography refinements
      addBase({
        'html': {
          '-webkit-font-smoothing': 'antialiased',
          '-moz-osx-font-smoothing': 'grayscale',
          'text-rendering': 'optimizeLegibility',
        },
      })
      
      addUtilities({
        // Surface treatments
        '.surface-primary': {
          'background-color': theme('colors.surface.0'),
          '@apply dark:bg-surface-900': {},
        },
        '.surface-elevated': {
          'background-color': theme('colors.surface.50'),
          '@apply dark:bg-surface-850': {},
        },
        '.surface-card': {
          'background-color': theme('colors.surface.0'),
          'border': `1px solid ${theme('colors.surface.200')}`,
          '@apply dark:bg-surface-800 dark:border-surface-700': {},
        },
        
        // Text utilities
        '.text-primary': {
          'color': theme('colors.ink.DEFAULT'),
          '@apply dark:text-ink-inverse': {},
        },
        '.text-secondary': {
          'color': theme('colors.ink.secondary'),
          '@apply dark:text-ink-inverse-secondary': {},
        },
        '.text-muted': {
          'color': theme('colors.ink.muted'),
          '@apply dark:text-ink-inverse-muted': {},
        },
        
        // Interactive states
        '.interactive': {
          'transition': 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            'transform': 'translateY(-1px)',
          },
          '&:active': {
            'transform': 'translateY(0) scale(0.98)',
          },
        },
        
        // Focus ring
        '.focus-ring': {
          '&:focus-visible': {
            'outline': 'none',
            'box-shadow': `0 0 0 2px ${theme('colors.surface.0')}, 0 0 0 4px ${theme('colors.accent.DEFAULT')}`,
          },
        },
        '.dark .focus-ring': {
          '&:focus-visible': {
            'box-shadow': `0 0 0 2px ${theme('colors.surface.900')}, 0 0 0 4px ${theme('colors.accent.light')}`,
        },
        },
        
        // Gradient text
        '.text-gradient': {
          'background': `linear-gradient(135deg, ${theme('colors.accent.DEFAULT')} 0%, ${theme('colors.accent.light')} 100%)`,
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
        },
        
        // Dividers
        '.divider-horizontal': {
          'height': '1px',
          'background': `linear-gradient(90deg, transparent, ${theme('colors.surface.200')}, transparent)`,
          '@apply dark:from-transparent dark:via-surface-700 dark:to-transparent': {},
        },
        
        // Scrollbar styles
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            'display': 'none',
          },
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': {
            'width': '6px',
            'height': '6px',
          },
          '&::-webkit-scrollbar-track': {
            'background': 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            'background': theme('colors.surface.200'),
            'border-radius': '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            'background': theme('colors.surface.300'),
          },
        },
        '.dark .scrollbar-thin': {
          '&::-webkit-scrollbar-thumb': {
            'background': theme('colors.surface.700'),
          },
          '&::-webkit-scrollbar-thumb:hover': {
            'background': theme('colors.surface.600'),
        },
        },
        
        // Glass effects (legacy support)
        '.glass-ultra': {
          'background': 'rgba(255, 255, 255, 0.85)',
          'backdrop-filter': 'blur(24px) saturate(150%)',
          '-webkit-backdrop-filter': 'blur(24px) saturate(150%)',
          'border': '1px solid rgba(0, 0, 0, 0.06)',
        },
        '.dark .glass-ultra': {
          'background': 'rgba(18, 18, 18, 0.9)',
          'border': '1px solid rgba(255, 255, 255, 0.06)',
        },
        '.glass-frosted': {
          'background': 'rgba(255, 255, 255, 0.7)',
          'backdrop-filter': 'blur(16px) saturate(140%)',
          '-webkit-backdrop-filter': 'blur(16px) saturate(140%)',
          'border': '1px solid rgba(0, 0, 0, 0.05)',
        },
        '.dark .glass-frosted': {
          'background': 'rgba(23, 23, 23, 0.8)',
          'border': '1px solid rgba(255, 255, 255, 0.05)',
        },
        
        // Drag region
        '.drag-region': {
          '-webkit-app-region': 'drag',
          },
        '.no-drag': {
          '-webkit-app-region': 'no-drag',
          },
        
        // Selection
        '.no-select': {
          '-webkit-user-select': 'none',
          '-moz-user-select': 'none',
          '-ms-user-select': 'none',
          'user-select': 'none',
        },
      })
    }),
  ],
}

export default config
