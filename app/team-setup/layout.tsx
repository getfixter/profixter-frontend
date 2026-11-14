import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your account",
  robots: { index: false, follow: false },
  // The setup token lives in the URL fragment, which is never sent anywhere; this keeps even the path out of Referer headers.
  referrer: "no-referrer",
};

export default function TeamSetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
