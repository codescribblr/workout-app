"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { useUser } from "@/contexts/UserContext";

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: userLoading } = useUser();
  
  // Get initial theme: localStorage > browser default > "system"
  const getInitialTheme = (): "light" | "dark" | "system" => {
    if (typeof window === "undefined") return "system";
    
    // 1. Check localStorage first (fastest, prevents flicker)
    const saved = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (saved) return saved;
    
    // 2. If no localStorage, use browser default (system preference)
    // This is synchronous and prevents flicker
    return "system";
  };
  
  const [initialTheme, setInitialTheme] = useState<"light" | "dark" | "system">(getInitialTheme());
  const [mounted, setMounted] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;
    setMounted(true);
  }, []);

  // Update theme when profile loads (only once, and only if different from current)
  useEffect(() => {
    if (!mounted || typeof window === "undefined" || profileLoaded || userLoading) return;

    if (user) {
      // User is authenticated
      if (profile !== null) {
        // Profile has loaded
        setProfileLoaded(true);
        
        const dbTheme = profile?.preferences?.theme;
        const currentTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null || "system";
        
        if (dbTheme && dbTheme !== currentTheme) {
          // Profile has a different theme - update both state and localStorage
          // This should be rare since localStorage should already match from previous session
          setInitialTheme(dbTheme);
          localStorage.setItem("theme", dbTheme);
        } else if (dbTheme) {
          // Same theme - just ensure localStorage is synced
          localStorage.setItem("theme", dbTheme);
        } else {
          // No theme in profile - save current theme to localStorage
          // (Profile will be updated when user changes theme via ThemeSettings)
          localStorage.setItem("theme", currentTheme);
        }
      }
      // If profile is null but user exists, profile might still be loading - wait
    } else {
      // Not authenticated - profile won't load, mark as loaded
      setProfileLoaded(true);
    }
  }, [user, profile, mounted, profileLoaded, userLoading]);

  // Always render ThemeProvider to ensure context is available
  // It will handle SSR safely internally
  return (
    <ThemeProvider initialTheme={initialTheme} userId={user?.id}>
      {children}
    </ThemeProvider>
  );
}
