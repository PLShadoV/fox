# FoxESS UI Patch (fix for missing modules)

This patch adds:
- `@/components/Nav`
- `@/components/Card` (with `subtitle` and `right` props)
- `@/lib/base-url`
- Minimal `app/layout.tsx`, `app/page.tsx`, styles and Tailwind setup

## How to merge into your repo

1. Copy `components/Nav.tsx`, `components/Card.tsx` into your repo's `components/` folder.
2. Copy `src/lib/base-url.ts` into `src/lib/`.
3. Ensure your `app/layout.tsx` imports `./globals.css` and `@/components/Nav`.
4. Make sure you have Tailwind set up (`tailwind.config.js`, `postcss.config.js`, `app/globals.css`).
5. Verify your `tsconfig.json` has these path aliases:
   - `"@/components/*": ["components/*"]`
   - `"@/lib/*": ["src/lib/*"]`
6. Keep your Prisma/DB files as-is (this patch uses only UI files).
7. Build on Vercel.

## Note
- The `/api/foxess/ping` route here is a stub – replace with your real handler later.
