export function Stat({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: "red";
}) {
  const valueCls = accent === "red" ? "text-red-700" : "text-slate-800";
  return (
    <span className="inline-flex flex-col rounded bg-slate-50 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`font-mono text-sm ${valueCls}`}>{value}</span>
    </span>
  );
}
