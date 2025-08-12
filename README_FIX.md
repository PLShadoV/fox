# Fix: ENOENT ... page_client-reference-manifest.js during Vercel build

**Why this happens**
Next.js 14 sometimes crashes on Vercel when the landing page is inside a *grouped* app segment,
e.g. `app/(dashboard)/page.tsx`. In some cases the server tracer looks for a
`page_client-reference-manifest.js` file in that grouped segment and fails with ENOENT.

**What this patch does**
1) Moves the landing page to `app/page.tsx` (no grouped folder).
2) Forces runtime to Node.js and disables prerendering for `/` to keep it dynamic.
3) Makes the `Card` component accept an optional `right` element (used on `/history`).

**How to apply**
1. Delete the folder `app/(dashboard)` from your repo (or move its *page.tsx* out).
2. Copy the files from this ZIP into your repo root (they mirror your structure).
   - `app/page.tsx` (new landing page)
   - `components/ui/Card.tsx` (updated props: `title?`, `subtitle?`, `right?`)
   - `next.config.js` (ensures no static export and solid defaults)
3. Commit & deploy.

> If you still have a `app/(dashboard)/page.tsx` file in Git, the build may fail again.
  Make sure it's removed or renamed.

