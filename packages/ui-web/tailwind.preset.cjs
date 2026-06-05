/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        coral: {
          50: '#FFF1F0',
          100: '#FFD7D3',
          200: '#FFB1A8',
          300: '#FF8A7C',
          400: '#FF6F60',
          500: '#FF5A5F',
          600: '#E04147',
          700: '#B92F35',
          800: '#922428',
          900: '#6E1B1F',
        },
        navy: {
          50: '#F1F4F8',
          100: '#D9E0EA',
          200: '#B3C2D5',
          300: '#8DA3C0',
          400: '#5E7A9E',
          500: '#3F5A82',
          600: '#2E4565',
          700: '#1F3148',
          800: '#142235',
          900: '#0B1727',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 4px 12px -2px rgb(0 0 0 / 0.06), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 12px 32px -8px rgb(0 0 0 / 0.12), 0 4px 8px -2px rgb(0 0 0 / 0.06)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
