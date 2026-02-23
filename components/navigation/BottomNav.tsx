"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Timer,
  FileText,
  ClipboardList,
  BarChart3,
  User,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Workout", icon: Timer },
  { href: "/plans", label: "Plans", icon: FileText },
  { href: "/history", label: "History", icon: ClipboardList },
  { href: "/progress", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Profile", icon: User },
];

const HIDE_NAV_PATHS = ["/login", "/signup"];

function shouldHideNav(pathname: string): boolean {
  if (HIDE_NAV_PATHS.includes(pathname)) return true;
  // Hide during active workout (full-screen experience)
  if (pathname.startsWith("/workouts/") && !pathname.endsWith("/new")) return true;
  return false;
}

export default function BottomNav() {
  const pathname = usePathname();

  if (shouldHideNav(pathname)) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-2 touch-manipulation ${
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              aria-label={label}
            >
              <Icon size={24} strokeWidth={2} className="shrink-0" />
              <span className="text-[10px] mt-0.5 hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
