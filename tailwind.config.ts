import type { Config } from 'tailwindcss'
export default {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme: { extend: { fontFamily: { sans: ['ui-sans-serif','system-ui','Inter','Segoe UI','Roboto','Helvetica Neue','Arial'] } } },
  plugins: []
} satisfies Config
