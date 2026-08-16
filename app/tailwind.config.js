/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: '#0b0c10',
          50: '#12141c',
          100: '#151821',
          200: '#1c202c',
        }
      }
    },
  },
  plugins: [],
}
