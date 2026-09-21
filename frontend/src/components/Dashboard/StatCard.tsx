export function StatCard({ label, value, icon, accent = false }: { label: string; value: string | number; icon: string; accent?: boolean }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl2 text-2xl ${accent ? "bg-accent-100" : "bg-brand-50"}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-extrabold text-gray-900">{value}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      </div>
    </div>
  );
}
