import type { Metadata } from "next";

/* A personal, signed link from an email: never indexed. */
export const metadata: Metadata = {
  title: { absolute: "Confirm Offers by Text | Profixter" },
  description: "Confirm that you'd like occasional ProFixter offers by text message.",
  robots: { index: false, follow: false },
};

export default function ConfirmTextsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
