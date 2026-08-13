import { BUSINESS_PHONE_DISPLAY } from "@/lib/seo";

/**
 * The customer-facing Fixter.
 *
 * Every member's Fixter is Roman today. ProFixter has one Fixter, so there is
 * deliberately no assignment system, no matching and no link to the technician
 * assigned to an individual booking - those are separate concerns and the
 * booking-level assignment must stay independent.
 *
 * When there are several Fixters, an admin will assign a primary Fixter per
 * household. The only thing that needs to change then is where getPrimaryFixter
 * reads from; every component already takes a Fixter as data rather than
 * hardcoding a name, a number or a photo.
 */
export type Fixter = {
  /** First name is what the customer sees. This is a relationship, not a directory entry. */
  firstName: string;
  /** Portrait in /public. Swapping the asset is a one-line change. */
  photoSrc: string;
  /**
   * How the portrait is framed. The source is a three-quarter shot, so it is
   * cropped tight to the face rather than being edited - the file is never
   * modified.
   */
  photoPosition: string;
  /** Display form, for reading aloud on screen. */
  phoneDisplay: string;
  /**
   * Dial form. Kept because it is real data about the Fixter, but nothing in
   * the customer frontend builds a link from it: his number is displayed, not
   * actioned. See the note below the type.
   */
  phoneE164: string;
};

const ROMAN: Fixter = {
  firstName: "Roman",
  photoSrc: "/images/Roman.png",
  // Frames head and shoulders. Keeps the face centred and pushes the older
  // branding on the clothing mostly out of the crop.
  photoPosition: "50% 24%",
  phoneDisplay: "253-254-9380",
  phoneE164: "+12532549380",
};

/**
 * The member's primary Fixter.
 *
 * Takes no argument yet on purpose: adding one later is a smaller change than
 * unpicking a fake parameter that every caller passes null to today.
 */
export function getPrimaryFixter(): Fixter {
  return ROMAN;
}

/*
 * There are deliberately no fixterCallHref / fixterTextHref helpers.
 *
 * The Fixter's number is shown to members as plain text, never as a tel: or
 * sms: action, so that reaching him is possible but not the easiest thing on
 * the page. Keeping link builders around would make a Call button a one-import
 * mistake. Customer Care below is the number that is meant to be tapped.
 */

/** ProFixter Customer Care, kept deliberately separate from the Fixter. */
export const CUSTOMER_CARE = {
  phoneDisplay: BUSINESS_PHONE_DISPLAY,
  phoneE164: "+16315991363",
  callHref: "tel:+16315991363",
};
