import { WORDMARK_FIXTER, WORDMARK_PRO } from "./wordmark-paths";

/**
 * The PROFIXTER wordmark, drawn inline so it can sit on any surface.
 *
 * Same artwork as public/images/logo-footer.svg: PRO in ProFixter blue, FIXTER
 * in the surface's ink. On the light header FIXTER is the brand navy, on the
 * dark footer it is near-white, so the header no longer needs a dark chip to
 * carry a light-on-dark file. The small "Long Island" tagline is left out: at
 * header size it was a smudge, and the footer says where we work in words.
 */
export default function Wordmark({
  tone = "dark",
  className = "",
  title = "Profixter",
}: {
  /** "dark" ink for light surfaces, "light" ink for dark ones. */
  tone?: "dark" | "light";
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 357 52"
      role="img"
      aria-label={title}
      className={`ui-wordmark ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={WORDMARK_PRO} fill="#306EEC" />
      <path d={WORDMARK_FIXTER} fill={tone === "dark" ? "#0B1628" : "#EEF2FF"} />
    </svg>
  );
}
