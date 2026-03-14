"use client";

import { useEffect, useState } from "react";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  tier: string;
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

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const response = await fetch("/api/users", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: UserRow[] };
        if (!cancelled) {
          setUsers(Array.isArray(payload.items) ? payload.items : []);
        }
      } catch {
        if (!cancelled) setUsers([]);
      }
    };

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

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
