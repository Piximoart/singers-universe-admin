"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mic2,
  Disc3,
  Music,
  FileText,
  ImageIcon,
  Users,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/homepage", label: "Homepage Hero", icon: ImageIcon },
  { href: "/singers", label: "Zpěváci", icon: Mic2 },
  { href: "/albums", label: "Alba", icon: Disc3 },
  { href: "/tracks", label: "Tracky", icon: Music },
  { href: "/posts", label: "Posty", icon: FileText },
  { href: "/stories", label: "Stories", icon: ImageIcon },
  { href: "/users", label: "Uživatelé", icon: Users },
];

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-s1 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 bg-s2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-s3 flex items-center justify-center">
            <span className="text-lime text-xs font-bold">SU</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-white font-display">Singers Universe</p>
            <p className="text-[10px] text-sub">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-s3 text-white"
                  : "text-sub hover:text-white hover:bg-s2"
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 bg-s2/50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-sub hover:text-white hover:bg-s3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/70"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Odhlásit se
        </button>
      </div>
    </aside>
  );
}
