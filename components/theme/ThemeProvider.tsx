"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  initialTheme = "system",
  userId,
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
  userId?: string;
}) {
  // Initialize system theme immediately if available (for SSR/hydration)
  const getInitialSystemTheme = (): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  // Get initial theme: prioritize localStorage (set by blocking script) over prop
  const getInitialTheme = (): Theme => {
    if (typeof window === "undefined") return initialTheme;
    // Blocking script already set localStorage, so read from there to match
    const saved = localStorage.getItem("theme") as Theme | null;
    return saved || initialTheme;
  };

  const [theme, setThemeState] = useState<Theme>(getInitialTheme());
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getInitialSystemTheme());
  
  // Only create supabase client on client side
  const supabase = typeof window !== "undefined" ? createClient() : null;

  // Update theme when initialTheme prop changes (e.g., after loading from database)
  // Only update if it's different to avoid unnecessary re-renders
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check if localStorage has a different value (shouldn't happen, but sync if needed)
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    if (storedTheme && storedTheme !== theme) {
      setThemeState(storedTheme);
      return;
    }
    
    // If prop changes and is different from current theme, update
    if (initialTheme !== theme && initialTheme !== storedTheme) {
      setThemeState(initialTheme);
      localStorage.setItem("theme", initialTheme);
    }
  }, [initialTheme]);

  // Detect system theme and update when it changes
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    // Set initial value
    updateSystemTheme();
    
    // Listen for changes
    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  // Apply theme to document
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    const effectiveTheme = theme === "system" ? systemTheme : theme;
    const root = document.documentElement;

    // Apply theme class immediately
    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // Also update localStorage to keep it in sync
    if (theme !== "system") {
      localStorage.setItem("theme", theme);
    }
  }, [theme, systemTheme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    
    // Save to localStorage immediately (for authenticated users)
    // This prevents flicker on next page load
    if (typeof window !== "undefined" && userId) {
      localStorage.setItem("theme", newTheme);
    }

    // Save to database if user is logged in
    if (userId && supabase) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("preferences")
        .eq("id", userId)
        .single();

      const updatedPreferences = {
        ...(profile?.preferences || {}),
        theme: newTheme,
      };

      await supabase
        .from("user_profiles")
        .update({ preferences: updatedPreferences })
        .eq("id", userId);
      
      // localStorage is already updated above, so both are in sync
    }
  };

  const effectiveTheme = theme === "system" ? systemTheme : theme;

  // Always render the Provider so context is available
  // Theme application happens in useEffect which only runs after mount
  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
