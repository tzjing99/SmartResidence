/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        coral: {
          500: '#FF5A5F',
          600: '#E04147',
        },
        navy: {
          700: '#1F3148',
          800: '#142235',
          900: '#0B1727',
        },
      },
    },
  },
};
