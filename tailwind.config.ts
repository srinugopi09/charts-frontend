import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // Colorblind-safe chart palettes
        chart: {
          // Default palette - 6 distinct colors safe for deuteranopia/protanopia
          blue: '#3b82f6',
          teal: '#06b6d4',
          orange: '#f97316',
          purple: '#8b5cf6',
          pink: '#ec4899',
          amber: '#f59e0b',

          // Sequential palette (light to dark blue)
          sequential: {
            100: '#dbeafe',
            200: '#bfdbfe',
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
          },

          // Status colors (RAG - Red/Amber/Green)
          status: {
            green: '#10b981',
            amber: '#f59e0b',
            red: '#ef4444',
          },
        },

        // Categorical palette for many categories (12 colors)
        categorical: {
          1: '#3b82f6',
          2: '#06b6d4',
          3: '#8b5cf6',
          4: '#f97316',
          5: '#ec4899',
          6: '#f59e0b',
          7: '#10b981',
          8: '#6366f1',
          9: '#14b8a6',
          10: '#a855f7',
          11: '#ef4444',
          12: '#84cc16',
        },
      },

      // Responsive breakpoints
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },

      // Animations
      keyframes: {
        bounce: {
          '0%, 100%': {
            transform: 'translateY(-25%)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
        slideIn: {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        fadeIn: {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
        shimmer: {
          '0%': {
            backgroundPosition: '-200% 0',
          },
          '100%': {
            backgroundPosition: '200% 0',
          },
        },
      },
      animation: {
        bounce: 'bounce 1s infinite',
        slideIn: 'slideIn 0.3s ease-out forwards',
        fadeIn: 'fadeIn 0.2s ease-out forwards',
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
