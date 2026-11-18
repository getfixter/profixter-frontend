import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  /*
   * Microsoft Clarity (loaded by GTM) records public pages; on the account
   * every name, phone, address and plan is masked in recordings. display:
   * contents keeps the wrapper out of the layout.
   */
  return (
    <div data-clarity-mask="true" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
