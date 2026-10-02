import type { Metadata } from "next";
import ReviewClient from "./ReviewClient";

export const metadata: Metadata = {
  title: "Review Event Photos | Profixter",
  robots: { index: false, follow: false },
};

export default function EventDisplayReviewPage() {
  return <ReviewClient />;
}
