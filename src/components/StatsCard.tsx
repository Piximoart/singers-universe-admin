import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  sub?: string;
}

export default function StatsCard({ label, value, icon: Icon, sub }: StatsCardProps) {
  return (
    <div className="bg-s1 border border-border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-sub uppercase tracking-wide2 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-sub mt-1">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-md bg-s2 border border-border flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-lime" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
