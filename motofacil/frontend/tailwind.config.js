/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Verde-mata — identidade principal da MotoFácil.
        brand: {
          50: '#EAF3EC',
          100: '#CFE4D6',
          200: '#9FC9AC',
          300: '#6FAE82',
          400: '#4C8B63',
          500: '#317049',
          600: '#1F5B3E',
          700: '#17452F',
          800: '#0F3323',
          900: '#0A2519',
        },
        // Âmbar — o farol da moto ao entardecer. Único acento de destaque.
        ember: {
          50: '#FDF3E4',
          100: '#FAE3BE',
          200: '#F4D19D',
          300: '#F0C589',
          400: '#E8A94C',
          500: '#DB8E2E',
          600: '#BD7420',
          700: '#97591A',
        },
        ink: '#211D17',
        paper: {
          DEFAULT: '#F6F1E7',
          dim: '#EEE6D3',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Work Sans"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(33, 29, 23, 0.06)',
      },
    },
  },
  plugins: [],
};
