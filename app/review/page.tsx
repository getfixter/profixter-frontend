import { redirect } from "next/navigation";

/**
 * Where "Share your feedback" in the post-visit email lands.
 *
 * Straight into Google's "write a review" box for the ProFixter Handyman
 * profile, rather than the profile page. It used to go through a maps.app.goo.gl
 * short link to the profile under its old name ("Home Maintenance by
 * Subscription"), which left a customer who had already decided to help us one
 * more search-and-tap away from doing it.
 *
 * The Place ID is a public identifier (it is in every Google Maps URL for the
 * business) and is the same one the backend uses for the rating badge. Google
 * asks the customer to sign in if they are not; that is Google's flow.
 *
 * Every customer who completes a visit gets the same link: nobody is screened
 * by how happy they seem first, and nothing is offered in exchange.
 *
 * Temporary on purpose, so the destination can change without browsers caching it.
 */
const GOOGLE_PLACE_ID = "ChIJjZtSCtd1XogR0kdxepnQJu8";

export default function Page() {
  redirect(`https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`);
}
