import { Mic2, Disc3, Music, FileText, Users, CreditCard } from "lucide-react";
import StatsCard from "@/components/StatsCard";

interface Stats {
  singers: number;
  albums: number;
  tracks: number;
  posts: number;
  users: number;
  paidSubscriptions: number;
}

async function getStats(): Promise<Stats> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "");
    const res = await fetch(`${baseUrl}/api/stats`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("stats failed");
    return res.json();
  } catch {
    return { singers: 0, albums: 0, tracks: 0, posts: 0, users: 0, paidSubscriptions: 0 };
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sub text-sm mt-1">Přehled platformy Singers Universe</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatsCard
          label="Zpěváci"
          value={stats.singers}
          icon={Mic2}
          sub="AI artisté"
        />
        <StatsCard
          label="Alba"
          value={stats.albums}
          icon={Disc3}
          sub="vydaná alba"
        />
        <StatsCard
          label="Tracky"
          value={stats.tracks}
          icon={Music}
          sub="skladby v katalogu"
        />
        <StatsCard
          label="Posty"
          value={stats.posts}
          icon={FileText}
          sub="feed příspěvky"
        />
        <StatsCard
          label="Uživatelé"
          value={stats.users}
          icon={Users}
          sub="registrovaní"
        />
        <StatsCard
          label="Předplatitelé"
          value={stats.paidSubscriptions}
          icon={CreditCard}
          sub="Backstage + Headliner"
        />
      </div>

      <div className="mt-8 bg-s1 border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Rychlý přístup</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            { href: "/singers/new", label: "+ Přidat zpěváka" },
            { href: "/albums/new", label: "+ Přidat album" },
            { href: "/tracks/new", label: "+ Přidat track" },
            { href: "/posts/new", label: "+ Přidat post" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="flex items-center px-3 py-2.5 bg-s2 border border-border rounded-md text-sub hover:text-white hover:border-lime/40 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
