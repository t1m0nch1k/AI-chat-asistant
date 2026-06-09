/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: '#0078d4',
        'accent-light': '#2899f5',
        'accent-dark': '#005a9e',
        'win11-dark': '#1c1c1c',
        'win11-surface': '#202020',
        'win11-card': '#2d2d2d',
        'win11-border': 'rgba(255,255,255,0.08)'
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}
