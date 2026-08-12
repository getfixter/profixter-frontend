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
  /** Dial form, for tel: and sms: links. */
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

export function fixterCallHref(fixter: Fixter) {
  return `tel:${fixter.phoneE164}`;
}

export function fixterTextHref(fixter: Fixter) {
  return `sms:${fixter.phoneE164}`;
}

/** ProFixter Customer Care, kept deliberately separate from the Fixter. */
export const CUSTOMER_CARE = {
  phoneDisplay: BUSINESS_PHONE_DISPLAY,
  phoneE164: "+16315991363",
  callHref: "tel:+16315991363",
};
