import type { Metadata } from "next";
import "./globals.css";
import { ThemeWrapper } from "@/components/theme/ThemeWrapper";
import { UserProvider } from "@/contexts/UserContext";

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Voice-first workout tracking with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // 1. Check localStorage first
                  var theme = localStorage.getItem('theme');
                  
                  // 2. If no localStorage, use system preference
                  if (!theme || theme === 'system') {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var effectiveTheme = prefersDark ? 'dark' : 'light';
                    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
                  } else {
                    // Apply theme from localStorage immediately
                    document.documentElement.classList.toggle('dark', theme === 'dark');
                  }
                } catch (e) {
                  // Fallback to system preference if localStorage fails
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  document.documentElement.classList.toggle('dark', prefersDark);
                }
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <UserProvider>
          <ThemeWrapper>{children}</ThemeWrapper>
        </UserProvider>
      </body>
    </html>
  );
}
