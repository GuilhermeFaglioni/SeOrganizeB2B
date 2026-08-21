import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { SwRegister } from "@/components/sw-register";
import { createThemeScope } from "@/components/ui/theme";
import { ThemeWatcher } from "@/components/theme-watcher";
import { I18nProvider } from "@/i18n/provider";
import { getSiteUrl } from "@/lib/site-url";
import { seOrganizeMaisDesignSystemTheme } from "@/themes/se-organize-mais-design-system";
import "./globals.css";

// The whole app renders client-side with next-intl's client provider.
// Force dynamic rendering so pages are never statically prerendered, which
// would run useTranslations in a server context without the request config
// and fail with next-intl ENVIRONMENT_FALLBACK.
export const dynamic = "force-dynamic";

const balsaThemeScope = createThemeScope(seOrganizeMaisDesignSystemTheme);

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "SeOrganize+",
    template: "%s | SeOrganize+",
  },
  description: "Organização colaborativa para equipes que executam.",
  applicationName: "SeOrganize+",
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "SeOrganize+",
    title: "SeOrganize+",
    description: "Organização colaborativa para equipes que executam.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "SeOrganize+",
    description: "Organização colaborativa para equipes que executam.",
  },
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
    <html
      lang="pt-BR"
      data-balsa-adapt
      data-theme="se-organize-mais-design-system"
      data-palette="se-organize-mais-design-system"
      style={balsaThemeScope.presentation.style as CSSProperties}
      suppressHydrationWarning
    >
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
