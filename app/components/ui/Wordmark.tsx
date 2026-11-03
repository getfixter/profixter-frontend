/**
 * The Profixter logo (2026-11-03): the hammer and the "PROFIXTER / Handyman
 * Membership" badge, public/images/profixter-logo.webp (a tight crop of the
 * owner's artwork; the full-size PNG sits beside it as profixter-logo.png).
 *
 * The badge carries its own black panel and white outline, so it reads on the
 * light header and the dark footer alike; `tone` is kept so callers need not
 * change, and no longer alters the artwork. Set a height in CSS (.ui-wordmark);
 * the width follows the artwork's 1231:520 shape.
 */
export const LOGO_SRC = "/images/profixter-logo.webp";
export const LOGO_RATIO = 1231 / 520;

export default function Wordmark({
  className = "",
  title = "Profixter",
}: {
  /** Kept for existing callers; the badge works on light and dark surfaces. */
  tone?: "dark" | "light";
  className?: string;
  title?: string;
}) {
  return (
    // A plain img: the logo is a fixed 40 KB file used in the header on every page, so the image optimizer adds nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_SRC} alt={title} width={640} height={270} className={`ui-wordmark ${className}`} decoding="async" draggable={false} />
  );
}
