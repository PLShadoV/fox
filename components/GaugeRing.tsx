export default function GaugeRing({ value, suffix='kW' }:{ value:number; suffix?:string }){
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="gauge" style={{ ['--pct' as any]: pct+'%' }}>
      <div className="ring">
        <div className="inner">
          <div className="text-lg font-semibold">{value.toFixed(2)}</div>
          <div className="text-xs muted">{suffix}</div>
        </div>
      </div>
    </div>
  );
}
