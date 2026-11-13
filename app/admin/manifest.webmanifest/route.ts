/*
 * The admin's own installed-app identity (owner decision Q-11, audit L.2):
 * opens on Jobs, stays inside /admin, and wears the hammer on accent blue so
 * it is told apart from the customer app (navy) on a home screen. No service
 * worker: the session token is in localStorage, and caching admin responses
 * on a shared or lost phone is a privacy risk (audit L.2 item 3).
 */
export const dynamic = "force-static";

const MANIFEST = {
  id: "/admin",
  name: "Profixter Admin",
  short_name: "PF Admin",
  description: "Jobs, schedule, customers and projects for the Profixter team.",
  start_url: "/admin/jobs",
  scope: "/admin",
  display: "standalone",
  orientation: "any",
  background_color: "#FFFFFF",
  theme_color: "#FFFFFF",
  categories: ["business", "productivity"],
  icons: [
    { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/admin-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Jobs", short_name: "Jobs", description: "Needs action and today's jobs", url: "/admin/jobs", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
    { name: "Schedule", short_name: "Schedule", url: "/admin/schedule", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
    { name: "Customers", short_name: "Customers", url: "/admin/customers", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
  ],
};

export function GET() {
  return new Response(JSON.stringify(MANIFEST), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
