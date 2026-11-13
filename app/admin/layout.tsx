import type { Metadata, Viewport } from "next";

/*
 * Everything under /admin: never indexed, and installed as its own app
 * ("Profixter Admin", opening on Jobs) rather than the customer site. The
 * customer manifest (app/manifest.ts) keeps start_url "/".
 *
 * The status bar is "default" (dark text on a light bar) here, not the site's
 * black-translucent: the admin header is white, and white status-bar text
 * would vanish on it. The header still pads env(safe-area-inset-top), so an
 * app installed before this change also lays out correctly.
 */
export const metadata: Metadata = {
  title: {
    default: "Profixter Admin",
    template: "%s · Profixter Admin",
  },
  robots: {
    index: false,
    follow: false,
  },
  manifest: "/admin/manifest.webmanifest",
  applicationName: "Profixter Admin",
  appleWebApp: {
    title: "PF Admin",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/admin-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/admin-apple-touch-180.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
