import type { Metadata } from "next";
import ReviewClient from "./ReviewClient";

export const metadata: Metadata = {
  title: "Review Event Photos",
  robots: { index: false, follow: false },
};

export default function EventDisplayReviewPage() {
  return <ReviewClient />;
}
