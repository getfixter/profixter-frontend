import localFont from "next/font/local";

/*
 * Cinzel for the admin office's knight labels, self-hosted like the site's
 * fonts (see app/site-fonts.ts): the same two files and unicode ranges
 * next/font/google fetched, weight 700, latin preloaded where this is used.
 * The pf-font-knight class (app/fonts.css) chains the two subsets into
 * --font-knight.
 */

const knightLatinExt = localFont({
  src: "../../../fonts/cinzel/cinzel-latin-ext.woff2",
  weight: "700",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-knight-latin-ext",
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

const knightLatin = localFont({
  src: "../../../fonts/cinzel/cinzel-latin.woff2",
  weight: "700",
  style: "normal",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  variable: "--font-knight-latin",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

export const knightFontVariables = [
  knightLatinExt.variable,
  knightLatin.variable,
  "pf-font-knight",
].join(" ");
