import type { Metadata } from "next";
import WelcomeFlow from "@/app/components/welcome/WelcomeFlow";

/**
 * The welcome entry at its own address (2026-11-19): for previews and tests,
 * and the way back from sign-up and a canceled checkout. The launch is the
 * homepage itself (lib/welcome-entry decides who sees it there). Not indexed;
 * the homepage is the page search engines know.
 */
export const metadata: Metadata = {
  title: { absolute: "Get started | Profixter" },
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
};

export default function StartPage() {
  return <WelcomeFlow entry="start" />;
}
