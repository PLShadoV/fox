/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: {
          900: "#0e1117",
          800: "#121621",
          700: "#1a1f2e"
        }
      },
      borderRadius: {
        '2xl': '1rem'
      }
    },
  },
  plugins: [],
};
