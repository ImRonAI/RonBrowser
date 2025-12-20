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
        // Ron Browser Brand Colors
        royal: {
          DEFAULT: '#2D3B87', // Royal blue (primary accent)
          light: '#3C50BE',   // Lighter royal blue
          dark: '#1A2454',    // Darker royal blue
          purple: '#4A3B87',  // Purple hint variant
        },
        // Light mode
        'ron-white': '#FFFFFF',
        'ron-text': '#0A0A0A', // Near-black, not gray
        // Dark mode
        'ron-black': '#0A0A0A',
        'ron-smoke': '#1A1A1A', // Secondary surfaces
        // Glass tints
        'glass-tint': '#E0F0FF',
        'glass-purple': '#E8E0FF',
      },
      fontFamily: {
        georgia: ['Georgia', 'serif'],
        raleway: ['Raleway', 'sans-serif'],
      },
      fontWeight: {
        'raleway-thin': '100',
        'raleway-extralight': '200',
        'raleway-light': '300',
        'raleway-bold': '700',
      },
      backdropBlur: {
        'glass': '40px',
        'glass-light': '20px',
      },
      backdropSaturate: {
        'glass': '200%',
      },
      animation: {
        'slide-in': 'slideIn 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(45, 59, 135, 0.08)',
        'glass-hover': '0 12px 48px 0 rgba(45, 59, 135, 0.12)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [
    // Glass variant plugin - works like dark: but for glass theme
    plugin(function({ addVariant }) {
      addVariant('glass', ':is(.glass &)')
    }),

    // Custom plugin for sophisticated glassmorphism
    function({ addUtilities }: any) {
      const newUtilities = {
        // Light mode - solid with subtle frost
        '.glass-ultra': {
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
        },
        // Dark mode - deep translucent
        '.glass-ultra-dark': {
          background: 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
        // Glass theme mode - maximum translucency (let wallpaper show through)
        '.glass-ultra-glass': {
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
        },
        // Light mode frosted
        '.glass-frosted': {
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(16px) saturate(140%)',
          WebkitBackdropFilter: 'blur(16px) saturate(140%)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
        },
        // Dark mode frosted
        '.glass-frosted-dark': {
          background: 'rgba(20, 20, 28, 0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        },
        // Glass theme mode frosted
        '.glass-frosted-glass': {
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        },
        '.noise-texture': {
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            opacity: '0.03',
            backgroundImage: "url('/textures/noise.png')",
            backgroundRepeat: 'repeat',
            pointerEvents: 'none',
            zIndex: '1',
          },
          '& > *': {
            position: 'relative',
            zIndex: '2',
          },
        },
        // Theme toggle track in glass mode
        '.glass-selector-track': {
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
        },
      }
      addUtilities(newUtilities)
    },
  ],
}

export default config
