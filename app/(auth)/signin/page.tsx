/*
 * /signin is the same screen as /signup: phone, Google, Apple and email, plus
 * "Sign in with password" for customers who already have one. The page reads
 * its own pathname to choose the sign-in copy. One component means the two can
 * never drift apart, and an existing customer who taps the wrong one still gets
 * in - every passwordless method signs in to an existing account.
 */
export { default } from "../signup/page";
