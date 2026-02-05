import type { Metadata } from "next";
import "./globals.css";
import { ThemeWrapper } from "@/components/theme/ThemeWrapper";
import { UserProvider } from "@/contexts/UserContext";

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Voice-first workout tracking with AI assistance",
  manifest: "/manifest.json",
  themeColor: "#4f46e5",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Workout Tracker",
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Workout Tracker" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
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
