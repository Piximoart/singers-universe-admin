"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Přihlášení selhalo");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Chyba připojení");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-s2 border border-border mb-4">
            <span className="text-lime text-lg font-bold">SU</span>
          </div>
          <h1 className="text-xl font-bold text-white">Singers Universe</h1>
          <p className="text-sub text-sm mt-1">Admin Panel</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-s1 border border-border rounded-lg p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Uživatelské jméno
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full bg-s2 border border-border rounded-md px-3 py-2.5 text-sm text-white placeholder:text-sub focus:outline-none focus:border-lime transition-colors"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Heslo
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-s2 border border-border rounded-md px-3 py-2.5 text-sm text-white placeholder:text-sub focus:outline-none focus:border-lime transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-lime text-bg font-semibold text-sm py-2.5 rounded-md hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Přihlašuji..." : "Přihlásit se"}
          </button>
        </form>
      </div>
    </div>
  );
}
