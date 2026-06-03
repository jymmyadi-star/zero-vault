/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#09090b',
          surface: '#18181b',
          border: '#27272a',
          muted: '#52525b',
          accent: '#a78bfa',
          danger: '#f87171',
          success: '#34d399',
        },
      },
    },
  },
  plugins: [],
};
