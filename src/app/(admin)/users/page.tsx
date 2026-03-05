import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  tier: string;
}

async function getUsers(): Promise<UserRow[]> {
  try {
    // Načteme Supabase Auth uživatele
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const authUsers = authData?.users ?? [];

    // Načteme subscriptions
    const { data: subs } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id, tier");

    const subMap = new Map((subs ?? []).map((s) => [s.user_id, s.tier]));

    return authUsers.map((u) => ({
      id: u.id,
      email: u.email ?? "—",
      created_at: u.created_at,
      tier: subMap.get(u.id) ?? "listener",
    }));
  } catch {
    return [];
  }
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    headliner: "bg-yellow-500/15 text-yellow-400",
    backstage: "bg-purple-500/15 text-purple-400",
    listener: "bg-s3 text-sub",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        styles[tier] ?? styles.listener
      }`}
    >
      {tier}
    </span>
  );
}

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Uživatelé</h1>
        <p className="text-sub text-sm mt-1">
          Přehled registrovaných uživatelů ({users.length})
        </p>
      </div>

      <div className="bg-s1 border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs text-sub uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-left text-xs text-sub uppercase tracking-wide">Tarif</th>
              <th className="px-4 py-3 text-left text-xs text-sub uppercase tracking-wide">Registrace</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sub">
                  Žádní uživatelé
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-s2 transition-colors">
                  <td className="px-4 py-3 text-white">{user.email}</td>
                  <td className="px-4 py-3">
                    <TierBadge tier={user.tier} />
                  </td>
                  <td className="px-4 py-3 text-sub">
                    {user.created_at?.slice(0, 10) ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
