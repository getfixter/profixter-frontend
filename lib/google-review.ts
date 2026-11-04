/*
 * The Google Business Profile for ProFixter Handyman.
 *
 * The Place ID is a public identifier (it is in every Google Maps URL for the
 * business) and the same one the backend uses for the rating badge.
 */
export const GOOGLE_PLACE_ID = "ChIJjZtSCtd1XogR0kdxepnQJu8";

/* Google's own "write a review" box, which is where /review sends people. */
export const GOOGLE_WRITE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;

/* The profile itself, to READ reviews ("View reviews"), by the same Place ID - never the old short link under the former name. */
export const GOOGLE_READ_REVIEWS_URL = `https://www.google.com/maps/search/?api=1&query=ProFixter&query_place_id=${GOOGLE_PLACE_ID}`;

export type ReviewVia = "email" | "account" | "home" | "other";

/* Every "leave a review" link on the site goes through /review, tagged with where it was. */
export const reviewHref = (via: Exclude<ReviewVia, "other">) => `/review?via=${via}`;
