import Card from '@/components/Card';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="grid gap-4">
      <Card title="Dashboard" subtitle="Wersja minimalna">
        <div className="text-sm text-white/80">
          Wybierz zakładkę „FoxESS” w górnym menu, aby wykonać ping API.
        </div>
      </Card>
    </div>
  );
}
