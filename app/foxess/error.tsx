'use client';

import Link from 'next/link';

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold">Coś poszło nie tak na serwerze</h2>
      <p className="muted text-sm break-all">
        {error?.message} {error?.digest ? `(digest: ${error.digest})` : null}
      </p>
      <div className="flex gap-2">
        <Link className="btn" href="/">← Powrót</Link>
        <a className="btn btn-primary" href="/api/foxess/ping">Spróbuj API</a>
      </div>
    </div>
  );
}
