import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SwRegister } from "@/components/sw-register";
import { ThemeWatcher } from "@/components/theme-watcher";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SeOrganize+",
    template: "%s | SeOrganize+",
  },
  description: "Organização colaborativa para equipes que executam.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SeOrganize+",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Inline script to detect system theme before paint (prevents FOUC)
const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') {
        document.documentElement.classList.toggle('dark', stored === 'dark');
      } else {
        document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    } catch(e) {
      document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  })();
`;

// Inline script to set the saved locale lang before hydration
const localeScript = `
  (function() {
    try {
      var match = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/);
      if (match) {
        var locale = decodeURIComponent(match[1]);
        if (locale === 'pt-BR' || locale === 'en') {
          document.documentElement.lang = locale;
        }
      }
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
      </head>
      <body>
        <I18nProvider>
          <ThemeWatcher />
          <SwRegister />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
