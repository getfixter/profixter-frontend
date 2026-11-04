import type { Metadata } from "next";
import ReviewRedirect from "./ReviewRedirect";

/**
 * Where "Share your feedback" in the post-visit email - and every "Leave a
 * review" on the site - lands.
 *
 * Straight into Google's "write a review" box for the ProFixter Handyman
 * profile (lib/google-review.ts), rather than the profile page. It used to go
 * through a maps.app.goo.gl short link to the profile under its old name
 * ("Home Maintenance by Subscription"), which left a customer who had already
 * decided to help us one more search-and-tap away from doing it. Google asks
 * the customer to sign in if they are not; that is Google's flow.
 *
 * Every customer who completes a visit gets the same link: nobody is screened
 * by how happy they seem first, and nothing is offered in exchange.
 *
 * Since 2026-11-03 the page counts the open before handing over (anonymously:
 * a day, a place, a number - ReviewRedirect), which is why it is a page and not
 * a server redirect. An open is someone reaching Google's form, never proof
 * that a review was posted.
 */
export const metadata: Metadata = {
  title: "Leave a Google review",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ReviewRedirect />;
}
