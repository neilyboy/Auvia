/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        auvia: {
          dark: '#0a0a0f',
          darker: '#050508',
          card: '#12121a',
          border: '#1f1f2e',
          accent: '#6366f1',
          'accent-hover': '#818cf8',
          muted: '#6b7280',
          light: '#e5e7eb'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',
      }
    },
  },
  plugins: [],
}
