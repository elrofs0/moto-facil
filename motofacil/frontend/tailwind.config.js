/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EAF4EE',
          100: '#CFE5D8',
          600: '#1A6B4A',
          700: '#145C43',
          800: '#0E4531',
        },
        ink: '#1B211D',
        paper: '#F7F5F0',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Work Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
