import ClientChart from "./price-chart";
import SummaryTiles from "./summary-tiles";

export default async function DashboardPage() {
  // server component can fetch initial summaries if needed
  return (
    <main className="grid gap-4">
      <SummaryTiles />
      <div className="card">
        <ClientChart />
      </div>
    </main>
  );
}
