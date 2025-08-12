# Patch: fix dashboard build (remove `dynamic` exports) + Card props

- Replaces `app/(dashboard)/page.tsx` with a client component (no `export const dynamic` etc.).
- Updates `components/ui/Card.tsx` to accept `subtitle` and `right` props.

Copy these files into your repo keeping the same paths, commit and redeploy on Vercel.
