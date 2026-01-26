"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import Button from "@/components/ui/Button";

export default function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/hydration, render with a neutral state
  if (!mounted) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Theme Preferences
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Choose your preferred color theme
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="md" disabled>
                Light
              </Button>
              <Button variant="secondary" size="md" disabled>
                Dark
              </Button>
              <Button variant="secondary" size="md" disabled>
                System
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Theme Preferences
      </h2>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Choose your preferred color theme
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => setTheme("light")}
              variant={theme === "light" ? "primary" : "secondary"}
              size="md"
            >
              Light
            </Button>
            <Button
              onClick={() => setTheme("dark")}
              variant={theme === "dark" ? "primary" : "secondary"}
              size="md"
            >
              Dark
            </Button>
            <Button
              onClick={() => setTheme("system")}
              variant={theme === "system" ? "primary" : "secondary"}
              size="md"
            >
              System
            </Button>
          </div>
          {theme === "system" && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Using your system preference
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
