import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/api",
        "/login",
        "/register",
        "/signin",
        "/signup",
        "/forgot-password",
        "/book/confirmation",
        "/confirmationpage",
        "/review",
        "/tip",
        "/exterior-preview",
        "/faq-preview",
        "/home-ending-preview",
        "/included-visits-preview",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
