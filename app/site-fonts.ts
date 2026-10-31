import localFont from "next/font/local";

/*
 * The site's typefaces, self-hosted (app/fonts/, each folder with its OFL).
 *
 * These are the exact files and unicode ranges next/font/google used to fetch
 * from Google at build time: every file is byte-identical to what production
 * served before the switch. Building no longer depends on fonts.gstatic.com.
 * That dependency broke on 2026-10-31, when Vercel's builders started getting
 * font URLs with a query string (/l/font?kit=...&skey=...) that Turbopack in
 * Next 16.0.7 could not resolve.
 *
 * Google splits a family into one file per script subset, each limited by a
 * unicode-range so a browser only downloads the scripts a page actually uses.
 * next/font/local has no per-file unicode-range, so each subset is its own
 * face here, and fonts.css chains them back into the one variable each family
 * always had (--font-geist-sans and so on), followed by the same
 * metric-matched fallback next/font/google generated.
 *
 * Unchanged from before: families, weights, styles, character coverage,
 * font-display: swap, and preloading (the Geist latin file only).
 */

const geistSansCyrillicExt = localFont({
  src: "./fonts/geist/geist-cyrillic-ext.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-sans-cyrillic-ext",
  declarations: [{ prop: "unicode-range", value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F" }],
});

const geistSansCyrillic = localFont({
  src: "./fonts/geist/geist-cyrillic.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-sans-cyrillic",
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
});

const geistSansVietnamese = localFont({
  src: "./fonts/geist/geist-vietnamese.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-sans-vietnamese",
  declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

const geistSansLatinExt = localFont({
  src: "./fonts/geist/geist-latin-ext.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-sans-latin-ext",
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

const geistSansLatin = localFont({
  src: "./fonts/geist/geist-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  variable: "--font-geist-sans-latin",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

const geistMonoCyrillicExt = localFont({
  src: "./fonts/geist-mono/geist-mono-cyrillic-ext.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-mono-cyrillic-ext",
  declarations: [{ prop: "unicode-range", value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F" }],
});

const geistMonoCyrillic = localFont({
  src: "./fonts/geist-mono/geist-mono-cyrillic.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-mono-cyrillic",
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
});

const geistMonoSymbols2 = localFont({
  src: "./fonts/geist-mono/geist-mono-symbols2.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-mono-symbols2",
  declarations: [{ prop: "unicode-range", value: "U+2000-2001, U+2004-2008, U+200A, U+23B8-23BD, U+2500-259F" }],
});

const geistMonoVietnamese = localFont({
  src: "./fonts/geist-mono/geist-mono-vietnamese.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-mono-vietnamese",
  declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

const geistMonoLatinExt = localFont({
  src: "./fonts/geist-mono/geist-mono-latin-ext.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-mono-latin-ext",
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

const geistMonoLatin = localFont({
  src: "./fonts/geist-mono/geist-mono-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-mono-latin",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

const montserratCyrillicExt = localFont({
  src: [
    { path: "./fonts/montserrat/montserrat-cyrillic-ext.woff2", weight: "400", style: "normal" },
    { path: "./fonts/montserrat/montserrat-cyrillic-ext.woff2", weight: "500", style: "normal" },
    { path: "./fonts/montserrat/montserrat-cyrillic-ext.woff2", weight: "600", style: "normal" },
    { path: "./fonts/montserrat/montserrat-cyrillic-ext.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-montserrat-cyrillic-ext",
  declarations: [{ prop: "unicode-range", value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F" }],
});

const montserratCyrillic = localFont({
  src: [
    { path: "./fonts/montserrat/montserrat-cyrillic.woff2", weight: "400", style: "normal" },
    { path: "./fonts/montserrat/montserrat-cyrillic.woff2", weight: "500", style: "normal" },
    { path: "./fonts/montserrat/montserrat-cyrillic.woff2", weight: "600", style: "normal" },
    { path: "./fonts/montserrat/montserrat-cyrillic.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-montserrat-cyrillic",
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
});

const montserratVietnamese = localFont({
  src: [
    { path: "./fonts/montserrat/montserrat-vietnamese.woff2", weight: "400", style: "normal" },
    { path: "./fonts/montserrat/montserrat-vietnamese.woff2", weight: "500", style: "normal" },
    { path: "./fonts/montserrat/montserrat-vietnamese.woff2", weight: "600", style: "normal" },
    { path: "./fonts/montserrat/montserrat-vietnamese.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-montserrat-vietnamese",
  declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

const montserratLatinExt = localFont({
  src: [
    { path: "./fonts/montserrat/montserrat-latin-ext.woff2", weight: "400", style: "normal" },
    { path: "./fonts/montserrat/montserrat-latin-ext.woff2", weight: "500", style: "normal" },
    { path: "./fonts/montserrat/montserrat-latin-ext.woff2", weight: "600", style: "normal" },
    { path: "./fonts/montserrat/montserrat-latin-ext.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-montserrat-latin-ext",
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

const montserratLatin = localFont({
  src: [
    { path: "./fonts/montserrat/montserrat-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/montserrat/montserrat-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/montserrat/montserrat-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/montserrat/montserrat-latin.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-montserrat-latin",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

const cormorantCyrillicExt = localFont({
  src: [
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-ext-italic.woff2", weight: "300", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-ext-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-ext-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-ext.woff2", weight: "300", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-ext.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-ext.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-gift-display-cyrillic-ext",
  declarations: [{ prop: "unicode-range", value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F" }],
});

const cormorantCyrillic = localFont({
  src: [
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-italic.woff2", weight: "300", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic.woff2", weight: "300", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-cyrillic.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-gift-display-cyrillic",
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
});

const cormorantVietnamese = localFont({
  src: [
    { path: "./fonts/cormorant-garamond/cormorant-garamond-vietnamese-italic.woff2", weight: "300", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-vietnamese-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-vietnamese-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-vietnamese.woff2", weight: "300", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-vietnamese.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-vietnamese.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-gift-display-vietnamese",
  declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

const cormorantLatinExt = localFont({
  src: [
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-ext-italic.woff2", weight: "300", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-ext-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-ext-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-ext.woff2", weight: "300", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-ext.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-ext.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-gift-display-latin-ext",
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

const cormorantLatin = localFont({
  src: [
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-italic.woff2", weight: "300", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin.woff2", weight: "300", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-gift-display-latin",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

/* Every subset's variable class, for the root element (app/layout.tsx). */
export const siteFontVariables = [
  geistSansCyrillicExt.variable,
  geistSansCyrillic.variable,
  geistSansVietnamese.variable,
  geistSansLatinExt.variable,
  geistSansLatin.variable,
  geistMonoCyrillicExt.variable,
  geistMonoCyrillic.variable,
  geistMonoSymbols2.variable,
  geistMonoVietnamese.variable,
  geistMonoLatinExt.variable,
  geistMonoLatin.variable,
  montserratCyrillicExt.variable,
  montserratCyrillic.variable,
  montserratVietnamese.variable,
  montserratLatinExt.variable,
  montserratLatin.variable,
  cormorantCyrillicExt.variable,
  cormorantCyrillic.variable,
  cormorantVietnamese.variable,
  cormorantLatinExt.variable,
  cormorantLatin.variable,
].join(" ");
